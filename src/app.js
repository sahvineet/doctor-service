import express from "express";

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function createApp(pool) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "doctor-service" });
  });

  app.post("/doctors", async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const specialization = typeof req.body?.specialization === "string"
      ? req.body.specialization.trim()
      : "";
    if (!name || !specialization) {
      return res.status(400).json({ error: "name and specialization are required" });
    }

    const { rows } = await pool.query(
      "INSERT INTO doctors (name, specialization) VALUES ($1, $2) RETURNING id, name, specialization",
      [name, specialization],
    );
    return res.status(201).json(rows[0]);
  });

  app.get("/doctors", async (_req, res) => {
    const { rows } = await pool.query(
      "SELECT id, name, specialization FROM doctors ORDER BY id",
    );
    res.json(rows);
  });

  app.post("/doctors/:doctorId/slots", async (req, res) => {
    const doctorId = Number(req.params.doctorId);
    const { startsAt } = req.body ?? {};
    if (!Number.isSafeInteger(doctorId) || doctorId < 1 || !isValidDate(startsAt)) {
      return res.status(400).json({ error: "valid doctorId and startsAt are required" });
    }
    if (Date.parse(startsAt) <= Date.now()) {
      return res.status(400).json({ error: "startsAt must be in the future" });
    }

    const doctor = await pool.query("SELECT id FROM doctors WHERE id = $1", [doctorId]);
    if (doctor.rowCount === 0) {
      return res.status(404).json({ error: "doctor not found" });
    }

    try {
      const { rows } = await pool.query(
        "INSERT INTO doctor_slots (doctor_id, starts_at) VALUES ($1, $2) RETURNING id, doctor_id, starts_at",
        [doctorId, startsAt],
      );
      return res.status(201).json(rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "slot already exists for this doctor" });
      }
      throw error;
    }
  });

  app.get("/doctors/:doctorId/slots", async (req, res) => {
    const doctorId = Number(req.params.doctorId);
    const { from, to } = req.query;
    if (!Number.isSafeInteger(doctorId) || doctorId < 1) {
      return res.status(400).json({ error: "doctorId must be a positive integer" });
    }
    if ((from && !isValidDate(from)) || (to && !isValidDate(to))) {
      return res.status(400).json({ error: "from and to must be valid timestamps" });
    }

    const doctor = await pool.query("SELECT id FROM doctors WHERE id = $1", [doctorId]);
    if (doctor.rowCount === 0) {
      return res.status(404).json({ error: "doctor not found" });
    }
    const { rows } = await pool.query(
      `SELECT id, doctor_id, starts_at
       FROM doctor_slots
       WHERE doctor_id = $1
         AND starts_at > NOW()
         AND ($2::timestamptz IS NULL OR starts_at >= $2)
         AND ($3::timestamptz IS NULL OR starts_at <= $3)
       ORDER BY starts_at`,
      [doctorId, from ?? null, to ?? null],
    );
    res.json(rows);
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
