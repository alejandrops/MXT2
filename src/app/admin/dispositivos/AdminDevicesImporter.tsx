"use client";

import { CsvImportDrawer } from "@/components/import-csv/CsvImportDrawer";
import { pickColumn } from "@/components/import-csv/csv-parser";
import type {
  TemplateColumn,
  ParsedRow,
} from "@/components/import-csv/types";
import { importDevices, type DeviceImportRow } from "./import-actions";

// ═══════════════════════════════════════════════════════════════
//  AdminDevicesImporter · drawer dark theme
//  ─────────────────────────────────────────────────────────────
//  Importa dispositivos en estado STOCK. Tras la importación, el
//  operador los asigna a vehículos desde /admin/dispositivos
//  (drawer existente).
// ═══════════════════════════════════════════════════════════════

const VALID_VENDORS = ["TELTONIKA", "QUECLINK", "CONCOX", "OTHER"] as const;

const VENDOR_MAP: Record<string, (typeof VALID_VENDORS)[number]> = {
  teltonika: "TELTONIKA",
  queclink: "QUECLINK",
  concox: "CONCOX",
  otro: "OTHER",
  other: "OTHER",
};

const IMEI_RE = /^\d{15}$/;

const TEMPLATE_COLUMNS: TemplateColumn[] = [
  {
    name: "imei",
    required: true,
    description:
      "IMEI del dispositivo · 15 dígitos numéricos. Único en todo el sistema.",
    example: "350612073987654",
    aliases: ["device_imei"],
  },
  {
    name: "vendor",
    required: true,
    description:
      "Marca · teltonika, queclink, concox, other. Determina los codecs y comandos disponibles.",
    example: "teltonika",
    aliases: ["marca", "fabricante"],
  },
  {
    name: "modelo",
    required: true,
    description:
      "Modelo del dispositivo · ej FMB920, GV58LAU, JM-VL01. Texto libre.",
    example: "FMB920",
    aliases: ["model"],
  },
  {
    name: "serial",
    required: false,
    description:
      "Número de serie del fabricante (S/N impreso en la etiqueta). Opcional · no todos los vendors lo proveen.",
    example: "TLT-2024-001234",
    aliases: ["serial_number", "sn", "serie"],
  },
  {
    name: "firmware",
    required: false,
    description: "Versión de firmware actualmente cargada · ej 03.27.04.Rev.06",
    example: "03.27.04",
    aliases: ["firmware_version", "fw"],
  },
];

function parseDeviceRow(
  raw: Record<string, string>,
  rowNumber: number,
): ParsedRow<DeviceImportRow> {
  const errors: { column: string; message: string }[] = [];

  const imei = pickColumn(raw, "imei", "device_imei").trim();
  const vendorStr = pickColumn(raw, "vendor", "marca", "fabricante").trim();
  const model = pickColumn(raw, "modelo", "model").trim();
  const serialNumber = pickColumn(
    raw,
    "serial",
    "serial_number",
    "sn",
    "serie",
  ).trim();
  const firmwareVersion = pickColumn(
    raw,
    "firmware",
    "firmware_version",
    "fw",
  ).trim();

  // IMEI
  if (imei.length === 0) {
    errors.push({ column: "imei", message: "Requerido" });
  } else if (!IMEI_RE.test(imei)) {
    errors.push({
      column: "imei",
      message: "IMEI inválido · debe ser exactamente 15 dígitos numéricos",
    });
  }

  // Vendor
  let vendor: DeviceImportRow["vendor"] = "OTHER";
  if (vendorStr.length === 0) {
    errors.push({ column: "vendor", message: "Requerido" });
  } else {
    const lower = vendorStr.toLowerCase();
    const mapped = VENDOR_MAP[lower];
    if (mapped) {
      vendor = mapped;
    } else if (
      VALID_VENDORS.includes(vendorStr.toUpperCase() as DeviceImportRow["vendor"])
    ) {
      vendor = vendorStr.toUpperCase() as DeviceImportRow["vendor"];
    } else {
      errors.push({
        column: "vendor",
        message: `Marca "${vendorStr}" inválida · usá: teltonika, queclink, concox, other`,
      });
    }
  }

  // Modelo
  if (model.length === 0) {
    errors.push({ column: "modelo", message: "Requerido" });
  } else if (model.length > 50) {
    errors.push({ column: "modelo", message: "Máximo 50 caracteres" });
  }

  // Serial / firmware · opcionales pero con max length
  if (serialNumber.length > 50) {
    errors.push({ column: "serial", message: "Máximo 50 caracteres" });
  }
  if (firmwareVersion.length > 30) {
    errors.push({ column: "firmware", message: "Máximo 30 caracteres" });
  }

  if (errors.length > 0) {
    return { rowNumber, parsed: null, errors, raw };
  }

  return {
    rowNumber,
    parsed: {
      rowNumber,
      imei,
      vendor,
      model,
      serialNumber: serialNumber.length > 0 ? serialNumber : null,
      firmwareVersion: firmwareVersion.length > 0 ? firmwareVersion : null,
    },
    errors: [],
    raw,
  };
}

export function AdminDevicesImporter() {
  return (
    <CsvImportDrawer<DeviceImportRow>
      entityName="dispositivo"
      entityNamePlural="dispositivos"
      templateColumns={TEMPLATE_COLUMNS}
      parseRow={parseDeviceRow}
      importRows={importDevices}
      theme="dark"
    />
  );
}
