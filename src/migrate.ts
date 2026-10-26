import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./db.js";

const DIR = path.resolve("db");
// Numero arbitrario para el advisory lock: identifica "el lock de migraciones".
const MIGRATION_LOCK_ID = 727001;

async function main() {
  const client = await pool.connect();
  try {
    // Si dos deploys corren migraciones a la vez, el segundo espera aca.
    // Mismo problema que los dos workers de la clase, resuelto con un lock.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     text PRIMARY KEY,
        aplicada_en timestamptz NOT NULL DEFAULT now()
      )`);

    const aplicadas = new Set(
      (await client.query("SELECT version FROM schema_migrations")).rows.map((r) => r.version as string),
    );

    // Orden alfabetico: por eso los archivos empiezan con 001, 002, ...
    const archivos = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
    const pendientes = archivos.filter((f) => !aplicadas.has(f));

    if (pendientes.length === 0) {
      console.log("Nada para aplicar: la base esta al dia.");
      return;
    }

    for (const archivo of pendientes) {
      const sql = await readFile(path.join(DIR, archivo), "utf8");
      // Cada migracion en su propia transaccion: si falla, la base queda como estaba.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [archivo]);
        await client.query("COMMIT");
        console.log(`Aplicada: ${archivo}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`Fallo ${archivo}. No se aplico nada de esta migracion.`);
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
