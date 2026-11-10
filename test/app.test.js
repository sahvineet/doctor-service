import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";

const pool = {
  query: async (sql) => {
    if (sql.includes("SELECT id FROM doctors")) {
      return { rowCount: 1, rows: [{ id: 7 }] };
    }
    if (sql.includes("INSERT INTO doctors")) {
      return { rows: [{ id: 7, name: "Dr Lee", specialization: "Cardiology" }] };
    }
    if (sql.includes("INSERT INTO doctor_slots")) {
      return { rows: [{ id: 10, doctor_id: 7, starts_at: "2030-01-01T10:00:00.000Z" }] };
    }
    if (sql.includes("FROM doctor_slots")) return { rows: [] };
    if (sql.includes("SELECT 1")) return { rows: [{ "?column?": 1 }] };
    throw new Error(`Unexpected SQL in test: ${sql}`);
  },
};

let app;
before(() => {
  app = createApp(pool);
});
after(() => {});

test("creates a doctor", async () => {
  const response = await request(app)
    .post("/doctors")
    .send({ name: "Dr Lee", specialization: "Cardiology" });
  assert.equal(response.status, 201);
  assert.equal(response.body.id, 7);
});

test("rejects a slot with an invalid timestamp", async () => {
  const response = await request(app)
    .post("/doctors/7/slots")
    .send({ startsAt: "not-a-date" });
  assert.equal(response.status, 400);
});
