import pg from "pg";

const { Pool } = pg;

export function createPool() {
  return new Pool({
    ...(process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT ?? 5432),
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
        }),
    max: 10,
    connectionTimeoutMillis: 5000,
  });
}

export async function initializeDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS doctor_slots (
      id BIGSERIAL PRIMARY KEY,
      doctor_id BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      starts_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (doctor_id, starts_at)
    );
  `);
}
