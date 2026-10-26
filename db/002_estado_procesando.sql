-- Agrega el estado 'procesando': un worker tomo la factura y la esta enviando al LLM.
-- No se puede editar un CHECK existente: se borra y se crea de nuevo.

ALTER TABLE facturas DROP CONSTRAINT facturas_estado_check;

ALTER TABLE facturas ADD CONSTRAINT facturas_estado_check
    CHECK (estado IN ('recibida', 'procesando', 'en_revision', 'aprobada', 'rechazada'));
