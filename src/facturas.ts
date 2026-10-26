import type { FastifyInstance } from "fastify";
import type { DatabaseError } from "pg";
import { pool } from "./db.js";
import { facturaSchema } from "./schemas.js";

const UNIQUE_VIOLATION = "23505";

export async function facturasRoutes(app: FastifyInstance) {
  app.post("/facturas", async (request, reply) => {
    // 1) Validar ANTES de tocar la base
    const parsed = facturaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "factura_invalida",
        detalle: parsed.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
      });
    }
    const f = parsed.data;

    // 2) Una transaccion: o se guarda todo (proveedor + factura + items) o nada
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Si el proveedor existe, no le pisamos la razon social: solo recuperamos su id
      const prov = await client.query(
        `INSERT INTO proveedores (cuit, razon_social) VALUES ($1, $2)
         ON CONFLICT (cuit) DO UPDATE SET razon_social = proveedores.razon_social
         RETURNING id`,
        [f.proveedor.cuit, f.proveedor.razon_social],
      );
      const proveedorId: string = prov.rows[0].id;

      const fac = await client.query(
        `INSERT INTO facturas
           (proveedor_id, tipo_comprobante, punto_venta, numero, fecha_emision,
            subtotal, descuento, iva, total, moneda, cae, cae_vencimiento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          proveedorId, f.tipo_comprobante, f.punto_venta, f.numero, f.fecha_emision,
          f.subtotal, f.descuento, f.iva, f.total, f.moneda, f.cae ?? null, f.cae_vencimiento ?? null,
        ],
      );
      const facturaId: string = fac.rows[0].id;

      for (const it of f.items) {
        await client.query(
          `INSERT INTO items (factura_id, descripcion, cantidad, precio_unitario, precio_total)
           VALUES ($1, $2, $3, $4, $5)`,
          [facturaId, it.descripcion, it.cantidad, it.precio_unitario, it.precio_total],
        );
      }

      await client.query("COMMIT");
      return reply.code(201).send({ id: facturaId });
    } catch (err) {
      await client.query("ROLLBACK");

      if ((err as DatabaseError).code === UNIQUE_VIOLATION) {
        // Buscamos la factura existente para decirle al cliente cual es
        const existente = await pool.query(
          `SELECT fa.id FROM facturas fa JOIN proveedores p ON p.id = fa.proveedor_id
           WHERE p.cuit = $1 AND fa.tipo_comprobante = $2 AND fa.punto_venta = $3 AND fa.numero = $4`,
          [f.proveedor.cuit, f.tipo_comprobante, f.punto_venta, f.numero],
        );
        return reply.code(409).send({
          error: "factura_duplicada",
          mensaje: "Ya existe una factura con ese proveedor, tipo, punto de venta y numero. Si no es un duplicado, revisa punto de venta y numero.",
          factura_existente_id: existente.rows[0]?.id ?? null,
        });
      }
      throw err;
    } finally {
      client.release();
    }
  });
}
