-- S2-L3 · Position.canData JSONB nullable · cache de datos CAN bus
-- por sample. Shape definido en src/lib/mock-can/types.ts.
-- Mientras el ingestor real (Flespi) no esté, queda null en todos
-- los rows · el código UI usa generateCanSnapshot como fallback.

ALTER TABLE "Position" ADD COLUMN "canData" JSONB;

ALTER TABLE "LivePosition" ADD COLUMN "canData" JSONB;
