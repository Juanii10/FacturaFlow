import { z } from "zod";

// Los importes viajan como string ("1210.00") y NUNCA como number.
// Un number en JSON se parsea como float y volveriamos al problema de 0.1 + 0.2.
const importe = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "importe invalido (max 2 decimales)");
const cantidad = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, "cantidad invalida (max 3 decimales)");

// "1210.5" con dec=2 -> 121050n. Trabajamos con enteros para comparar sin errores de redondeo.
function aUnidades(valor: string, dec: number): bigint {
  const [entera, decimales = ""] = valor.split(".");
  return BigInt(entera + decimales.padEnd(dec, "0"));
}

const itemSchema = z.object({
  descripcion: z.string().min(1),
  cantidad,
  precio_unitario: importe,
  precio_total: importe,
});

export const facturaSchema = z
  .object({
    proveedor: z.object({
      cuit: z.string().regex(/^\d{11}$/, "el CUIT son 11 digitos sin guiones"),
      razon_social: z.string().min(1),
    }),
    tipo_comprobante: z.enum(["A", "B", "C", "E", "M"]),
    punto_venta: z.number().int().min(1).max(99999),
    numero: z.number().int().min(1),
    fecha_emision: z.iso.date(),
    subtotal: importe,
    descuento: importe.default("0.00"),
    iva: importe.default("0.00"),
    total: importe,
    moneda: z.string().length(3).default("ARS"),
    cae: z.string().regex(/^\d{14}$/, "el CAE son 14 digitos").optional(),
    cae_vencimiento: z.iso.date().optional(),
    items: z.array(itemSchema).min(1),
  })
  .superRefine((f, ctx) => {
    // Regla 1: cantidad * precio_unitario == precio_total en cada item
    f.items.forEach((it, i) => {
      const calculado = aUnidades(it.cantidad, 3) * aUnidades(it.precio_unitario, 2);
      if (calculado !== aUnidades(it.precio_total, 2) * 1000n) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "precio_total"],
          message: "cantidad por precio_unitario no coincide con precio_total",
        });
      }
    });

    // Regla 2: la suma de los items es el subtotal
    const sumaItems = f.items.reduce((acc, it) => acc + aUnidades(it.precio_total, 2), 0n);
    if (sumaItems !== aUnidades(f.subtotal, 2)) {
      ctx.addIssue({ code: "custom", path: ["subtotal"], message: "la suma de los items no coincide con el subtotal" });
    }

    // Regla 3: subtotal - descuento + iva == total
    const esperado = aUnidades(f.subtotal, 2) - aUnidades(f.descuento, 2) + aUnidades(f.iva, 2);
    if (esperado !== aUnidades(f.total, 2)) {
      ctx.addIssue({ code: "custom", path: ["total"], message: "subtotal - descuento + iva no coincide con el total" });
    }
  });

export type Factura = z.infer<typeof facturaSchema>;
