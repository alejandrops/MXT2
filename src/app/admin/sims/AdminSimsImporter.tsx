"use client";

import { CsvImportDrawer } from "@/components/import-csv/CsvImportDrawer";
import { pickColumn } from "@/components/import-csv/csv-parser";
import type {
  TemplateColumn,
  ParsedRow,
} from "@/components/import-csv/types";
import { importSims, type SimImportRow } from "./import-actions";

// ═══════════════════════════════════════════════════════════════
//  AdminSimsImporter · drawer dark theme
//  ─────────────────────────────────────────────────────────────
//  Importa SIMs en estado STOCK. Tras la importación, el operador
//  las asigna a devices desde /admin/sims.
// ═══════════════════════════════════════════════════════════════

const VALID_CARRIERS = [
  "MOVISTAR",
  "CLARO",
  "PERSONAL",
  "ENTEL",
  "OTHER",
] as const;

const CARRIER_MAP: Record<string, (typeof VALID_CARRIERS)[number]> = {
  movistar: "MOVISTAR",
  claro: "CLARO",
  personal: "PERSONAL",
  entel: "ENTEL",
  otro: "OTHER",
  other: "OTHER",
};

const ICCID_RE = /^\d{19,20}$/;

const TEMPLATE_COLUMNS: TemplateColumn[] = [
  {
    name: "iccid",
    required: true,
    description:
      "Integrated Circuit Card ID · 19-20 dígitos numéricos. Es el ID único físico impreso en la SIM.",
    example: "8954310123456789012",
    aliases: ["sim_iccid", "icc"],
  },
  {
    name: "carrier",
    required: true,
    description:
      "Operador comercial · movistar, claro, personal, entel, other.",
    example: "movistar",
    aliases: ["operador", "operator"],
  },
  {
    name: "apn",
    required: true,
    description:
      'Access Point Name · necesario para conectarse a datos. Cada carrier tiene su APN. Ej · "internet.movistar.com.ar"',
    example: "internet.movistar.com.ar",
    aliases: ["access_point"],
  },
  {
    name: "telefono",
    required: false,
    description:
      "Número telefónico (MSISDN) asignado por el carrier. Algunas APIs IoT no lo exponen.",
    example: "+5491145678901",
    aliases: ["phone", "phone_number", "msisdn"],
  },
  {
    name: "imsi",
    required: false,
    description: "International Mobile Subscriber Identity · opcional.",
    example: "722010123456789",
    aliases: ["imsi_id"],
  },
  {
    name: "plan_mb",
    required: false,
    description:
      "Cuota mensual de datos en MB · default 50 (típico telemetría básica). Para cámaras suele ser 200-500.",
    example: "50",
    aliases: ["data_plan", "plan", "data_plan_mb", "datos_mb"],
  },
];

function parseSimRow(
  raw: Record<string, string>,
  rowNumber: number,
): ParsedRow<SimImportRow> {
  const errors: { column: string; message: string }[] = [];

  const iccid = pickColumn(raw, "iccid", "sim_iccid", "icc").trim();
  const carrierStr = pickColumn(
    raw,
    "carrier",
    "operador",
    "operator",
  ).trim();
  const apn = pickColumn(raw, "apn", "access_point").trim();
  const phoneNumber = pickColumn(
    raw,
    "telefono",
    "phone",
    "phone_number",
    "msisdn",
  ).trim();
  const imsi = pickColumn(raw, "imsi", "imsi_id").trim();
  const planStr = pickColumn(
    raw,
    "plan_mb",
    "data_plan",
    "plan",
    "data_plan_mb",
    "datos_mb",
  ).trim();

  // ICCID
  if (iccid.length === 0) {
    errors.push({ column: "iccid", message: "Requerido" });
  } else if (!ICCID_RE.test(iccid)) {
    errors.push({
      column: "iccid",
      message:
        "ICCID inválido · debe ser 19 o 20 dígitos numéricos (sin espacios)",
    });
  }

  // Carrier
  let carrier: SimImportRow["carrier"] = "OTHER";
  if (carrierStr.length === 0) {
    errors.push({ column: "carrier", message: "Requerido" });
  } else {
    const lower = carrierStr.toLowerCase();
    const mapped = CARRIER_MAP[lower];
    if (mapped) {
      carrier = mapped;
    } else if (
      VALID_CARRIERS.includes(
        carrierStr.toUpperCase() as SimImportRow["carrier"],
      )
    ) {
      carrier = carrierStr.toUpperCase() as SimImportRow["carrier"];
    } else {
      errors.push({
        column: "carrier",
        message: `Operador "${carrierStr}" inválido · usá: movistar, claro, personal, entel, other`,
      });
    }
  }

  // APN
  if (apn.length === 0) {
    errors.push({ column: "apn", message: "Requerido" });
  } else if (apn.length > 80) {
    errors.push({ column: "apn", message: "Máximo 80 caracteres" });
  }

  // Phone (opcional)
  if (phoneNumber.length > 30) {
    errors.push({ column: "telefono", message: "Máximo 30 caracteres" });
  }

  // IMSI (opcional · 14-15 dígitos típico)
  if (imsi.length > 0 && !/^\d{10,16}$/.test(imsi)) {
    errors.push({
      column: "imsi",
      message: "IMSI inválido · debe ser numérico (10-16 dígitos)",
    });
  }

  // Plan MB (opcional · default 50)
  let dataPlanMb = 50;
  if (planStr.length > 0) {
    const n = Number.parseInt(planStr.replace(/[.,\s]/g, ""), 10);
    if (Number.isNaN(n) || n < 1 || n > 100_000) {
      errors.push({
        column: "plan_mb",
        message: "Plan inválido · debe ser un entero entre 1 y 100.000 MB",
      });
    } else {
      dataPlanMb = n;
    }
  }

  if (errors.length > 0) {
    return { rowNumber, parsed: null, errors, raw };
  }

  return {
    rowNumber,
    parsed: {
      rowNumber,
      iccid,
      carrier,
      apn,
      phoneNumber: phoneNumber.length > 0 ? phoneNumber : null,
      imsi: imsi.length > 0 ? imsi : null,
      dataPlanMb,
    },
    errors: [],
    raw,
  };
}

export function AdminSimsImporter() {
  return (
    <CsvImportDrawer<SimImportRow>
      entityName="SIM"
      entityNamePlural="SIMs"
      templateColumns={TEMPLATE_COLUMNS}
      parseRow={parseSimRow}
      importRows={importSims}
      theme="dark"
    />
  );
}
