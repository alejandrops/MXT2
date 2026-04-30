// ═══════════════════════════════════════════════════════════════
//  Flespi message types (I1)
//  ─────────────────────────────────────────────────────────────
//  Flespi recibe datos de los devices Teltonika por TCP (codec 8/
//  8E/16) y los normaliza a JSON. Los messages tienen campos con
//  notación dotted ("position.latitude") y son enviados en arrays
//  por HTTPS streams cuando se configura el push hacia un endpoint
//  externo (en este caso, /api/ingest/flespi).
//
//  Referencia: https://flespi.com/kb/all-telemetry-parameters
//
//  Notas operativas:
//   · `ident` típicamente es el IMEI del Teltonika (15 dígitos).
//     Es el único identificador estable que el device físico expone
//     y que matchamos contra Device.imei.
//   · timestamps son Unix epoch en SEGUNDOS (con decimales para
//     sub-second precision). Hay que multiplicar por 1000 para
//     obtener milisegundos y construir un Date.
//   · `timestamp` = momento del fix GPS (recordedAt para nosotros).
//   · `server.timestamp` = momento en que flespi recibió el packet
//     (receivedAt aproximado). NO lo usamos · usamos el momento en
//     que llega al endpoint (Date.now()) como receivedAt.
//   · `position.speed` viene en km/h ya convertido por flespi.
//   · `position.direction` viene en grados (0-360, 0=N, 90=E, etc).
//   · `engine.ignition.status` es boolean. Algunos devices no lo
//     envían · default a true cuando hay velocidad > 0, false cuando
//     no hay y la última conocida era false.
//
//  Robustez: NO confiar en que todos los campos estén presentes
//  en cada message. Usar guards y skipear messages incompletos.
// ═══════════════════════════════════════════════════════════════

/** Un message individual de flespi · representa un fix GPS. */
export interface FlespiMessage {
  /** Identificador del device · típicamente el IMEI. */
  ident?: string;

  /** Unix epoch en segundos · momento del fix GPS. */
  timestamp?: number;

  /** Unix epoch en segundos · momento de llegada a flespi. */
  "server.timestamp"?: number;

  /** Latitud · grados decimales (-90 a 90). */
  "position.latitude"?: number;

  /** Longitud · grados decimales (-180 a 180). */
  "position.longitude"?: number;

  /** Velocidad sobre el suelo · km/h. */
  "position.speed"?: number;

  /** Rumbo · grados (0-360). */
  "position.direction"?: number;

  /** Altitud · metros sobre nivel del mar. */
  "position.altitude"?: number;

  /** Cantidad de satélites en la solución de fix. */
  "position.satellites"?: number;

  /** Validez del fix · false = sin fix válido. */
  "position.valid"?: boolean;

  /** HDOP · horizontal dilution of precision. <2 ideal, >5 pobre. */
  "position.hdop"?: number;

  /** Estado de ignición · true = encendido. */
  "engine.ignition.status"?: boolean;

  /** Estado de movimiento · true = vehículo en movimiento. */
  "movement.status"?: boolean;

  /** Voltaje de la fuente externa (alimentación del device en V). */
  "external.powersource.voltage"?: number;

  /** Voltaje de la batería interna del device (V). */
  "battery.voltage"?: number;

  /** Nivel de batería interna (%) · si el device lo reporta. */
  "battery.level"?: number;

  /** Cualquier otro campo · flespi puede mandar muchos más. */
  [key: string]: unknown;
}

/** Resultado de procesar un message · usado para reportar al cliente. */
export type MessageResult =
  | { status: "ok"; assetId: string; ident: string }
  | { status: "skipped"; reason: SkipReason; ident?: string; detail?: string }
  | { status: "error"; ident?: string; detail: string };

export type SkipReason =
  | "missing_ident"
  | "unknown_imei"
  | "device_unassigned"
  | "missing_position"
  | "missing_timestamp"
  | "invalid_fix";

/** Resumen del batch · lo que devolvemos en la response. */
export interface IngestSummary {
  received: number;
  ok: number;
  skipped: number;
  errors: number;
  skips_by_reason: Partial<Record<SkipReason, number>>;
  /** Detalle de los primeros N skips/errors para troubleshooting. */
  details: MessageResult[];
}
