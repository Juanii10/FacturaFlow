import Fastify from "fastify";
import { pool } from "./db.js";
import { facturasRoutes } from "./facturas.js";

const app = Fastify({ logger: true });

app.register(facturasRoutes);

// Health check: sirve para saber si el servicio y la base estan vivos.
app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok" };
});

const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
