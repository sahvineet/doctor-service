import { createApp } from "./app.js";
import { createPool, initializeDatabase } from "./db.js";

const port = Number(process.env.PORT ?? 3001);
const pool = createPool();

try {
  await initializeDatabase(pool);
  const server = createApp(pool).listen(port, () => {
    console.log(`doctor-service listening on ${port}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} catch (error) {
  console.error("doctor-service failed to initialize", error);
  await pool.end();
  process.exit(1);
}
