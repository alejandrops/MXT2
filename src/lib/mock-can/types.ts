// ═══════════════════════════════════════════════════════════════
//  src/lib/mock-can/types.ts
//  ─────────────────────────────────────────────────────────────
//  Mock virtual de datos CAN bus simulando Teltonika FMC003 con
//  motor diesel típico de transporte LATAM.
//
//  Status: MOCK · NO PERSISTIDO · solo en memoria del cliente.
//  Cuando Sprint 2 traiga la decisión Opción A (canData JSONB en
//  Position) o B (tabla CanReading), este shape es el contrato
//  que el UI ya consume · el reemplazo es transparente.
//
//  Decisión arquitectónica del PO:
//    · Una sola UI para todos los vehículos
//    · Si hay CAN, muestra datos extendidos
//    · Si no hay CAN, los campos quedan vacíos y se muestran "—"
//    · Discriminador: asset.canData ? extendido : básico
// ═══════════════════════════════════════════════════════════════

/**
 * Snapshot de datos CAN bus en un instante dado.
 * Todos los campos son lecturas de sensores ECU vía PID estándar
 * (mayormente OBD-II / J1939 según el motor).
 */
export interface CanSnapshot {
  // ── Motor ──────────────────────────────────────────────────
  /** Revoluciones por minuto · idle ~700, máx ~3500 en diesel típico */
  rpm: number;
  /** Temperatura del refrigerante · °C · normal 80-95 */
  engineTempC: number;
  /** Presión de aceite · kPa · normal 200-450 a régimen */
  oilPressureKpa: number;

  // ── Combustible ────────────────────────────────────────────
  /** Nivel de tanque · % */
  fuelLevelPct: number;
  /** Consumo instantáneo · L/100km · típico 25-40 L/100km en diesel pesado */
  fuelConsumptionLper100km: number;
  /** Eficiencia derivada · km/L · 100/fuelConsumptionLper100km */
  fuelEfficiencyKmL: number;

  // ── Distancia y tiempo ─────────────────────────────────────
  /** Odómetro real ECU · km · NO calculado por suma de positions */
  odometerKm: number;
  /** Horas totales del motor desde fabricación */
  engineHours: number;
  /** Segundos acumulados en idle del día · útil para detectar abuso */
  idleSecondsToday: number;
  /** Power Take-Off · accesorio externo activo (grúa, bomba, etc) */
  ptoActive: boolean;

  // ── Eventos discretos del vehículo ─────────────────────────
  /** Puerta del conductor abierta · evento típico CAN */
  doorOpen: boolean;
  /** Cinturón abrochado del conductor */
  seatbeltOk: boolean;
  /** Freno de mano puesto */
  parkingBrake: boolean;

  // ── Diagnóstico ────────────────────────────────────────────
  /**
   * Códigos de falla activos (DTC · Diagnostic Trouble Codes).
   * Estándar SAE J2012 · "P0301" misfire cilindro 1, "U0100" comm loss, etc.
   * Típicamente vacío · 5-10% de la flota tiene 1-2 codes.
   */
  dtcCodes: string[];

  // ── Eco-driving (validado por ECU, no por inferencia GPS) ─
  /** Score eco-driving instantáneo · 0-100 · combina aceleración suave,
   *  uso de freno motor, mantener RPM en banda óptima */
  ecoScore: number;
}

/**
 * Marker estable de capacidades del dispositivo · qué reporta y qué no.
 * Asignación determinística por assetId al cargar la flota.
 */
export interface DeviceCapabilities {
  /** El equipo es Teltonika FMC003 con módulo CAN bus activo */
  hasCanBus: boolean;
  /** Modelo del equipo · informativo */
  deviceModel: "FMC003" | "FMB920" | "FMC130" | "Legacy";
}
