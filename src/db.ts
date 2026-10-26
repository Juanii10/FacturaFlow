import pg from "pg";

// Un Pool mantiene varias conexiones abiertas y las reutiliza.
// Abrir una conexion nueva por cada request seria lento y agotaria la base.
export const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  max: 10,
});
