-- FacturaFlow: esquema inicial (semana 1)

CREATE TABLE proveedores (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cuit          char(11) NOT NULL UNIQUE,
    razon_social  text NOT NULL,
    creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE facturas (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proveedor_id     bigint NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    tipo_comprobante char(1) NOT NULL,
    punto_venta      integer NOT NULL,
    numero           bigint NOT NULL,
    fecha_emision    date NOT NULL,
    subtotal         numeric(14,2) NOT NULL,
    descuento        numeric(14,2) NOT NULL DEFAULT 0,
    iva              numeric(14,2) NOT NULL DEFAULT 0,
    total            numeric(14,2) NOT NULL,
    moneda           char(3) NOT NULL DEFAULT 'ARS',
    cae              char(14),
    cae_vencimiento  date,
    estado           text NOT NULL DEFAULT 'recibida'
                     CHECK (estado IN ('recibida', 'en_revision', 'aprobada', 'rechazada')),
    confianza        numeric(3,2) CHECK (confianza BETWEEN 0 AND 1),
    creada_en        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (proveedor_id, tipo_comprobante, punto_venta, numero)
);

CREATE TABLE items (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    factura_id       bigint NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
    descripcion      text NOT NULL,
    cantidad         numeric(12,3) NOT NULL,
    precio_unitario  numeric(14,2) NOT NULL,
    precio_total     numeric(14,2) NOT NULL
);

-- Postgres NO indexa las claves foraneas solo: lo hacemos a mano.
CREATE INDEX items_factura_id_idx ON items (factura_id);
