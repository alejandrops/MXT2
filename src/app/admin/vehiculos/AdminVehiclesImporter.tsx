"use client";

import { CsvImportDrawer } from "@/components/import-csv/CsvImportDrawer";
import { pickColumn } from "@/components/import-csv/csv-parser";
import type {
  TemplateColumn,
  ParsedRow,
} from "@/components/import-csv/types";
import {
  importVehicles,
  type VehicleImportRow,
} from "./import-actions";

// ═══════════════════════════════════════════════════════════════
//  VehiclesImporter · monta CsvImportDrawer con config dominio
// ═══════════════════════════════════════════════════════════════

const VALID_VEHICLE_TYPES = [
  "GENERIC",
  "CAR",
  "TRUCK",
  "MOTORCYCLE",
  "HEAVY_MACHINERY",
  "TRAILER",
  "SILO",
];

const VALID_MOBILITY = ["MOBILE", "FIXED"];

/** Mapa de strings comunes → enum. Tolera español/inglés/case-insensitive */
const VEHICLE_TYPE_MAP: Record<string, string> = {
  generico: "GENERIC",
  generic: "GENERIC",
  auto: "CAR",
  car: "CAR",
  automovil: "CAR",
  automóvil: "CAR",
  camion: "TRUCK",
  camión: "TRUCK",
  truck: "TRUCK",
  moto: "MOTORCYCLE",
  motocicleta: "MOTORCYCLE",
  motorcycle: "MOTORCYCLE",
  maquinaria: "HEAVY_MACHINERY",
  "maquinaria pesada": "HEAVY_MACHINERY",
  heavy_machinery: "HEAVY_MACHINERY",
  trailer: "TRAILER",
  acoplado: "TRAILER",
  silo: "SILO",
};

const MOBILITY_MAP: Record<string, string> = {
  movil: "MOBILE",
  móvil: "MOBILE",
  mobile: "MOBILE",
  fijo: "FIXED",
  fixed: "FIXED",
  estatico: "FIXED",
  estático: "FIXED",
};

const TEMPLATE_COLUMNS: TemplateColumn[] = [
  {
    name: "nombre",
    required: true,
    description: "Nombre identificatorio del vehículo · ej Camión 12, Volvo Norte",
    example: "Camión 12",
    aliases: ["name"],
  },
  {
    name: "cliente",
    required: true,
    description:
      "Slug del cliente al que pertenece · ej transportes-del-sur, minera-la-cumbre. Lo encontrás en la URL de cada cliente o en /admin/clientes.",
    example: "transportes-del-sur",
    aliases: ["account", "account_slug", "slug"],
  },
  {
    name: "patente",
    required: false,
    description: "Patente del vehículo · 6-7 caracteres. Único en todo el sistema",
    example: "AB123CD",
    aliases: ["plate", "license_plate", "dominio"],
  },
  {
    name: "vin",
    required: false,
    description: "Número de chasis · 17 caracteres",
    example: "1FTFW1ET5DKE12345",
    aliases: ["chasis"],
  },
  {
    name: "marca",
    required: false,
    description: "Marca del vehículo · ej Volvo, Mercedes, Ford",
    example: "Volvo",
    aliases: ["make"],
  },
  {
    name: "modelo",
    required: false,
    description: "Modelo · ej FH540, Sprinter, Hilux",
    example: "FH540",
    aliases: ["model"],
  },
  {
    name: "año",
    required: false,
    description: "Año de fabricación · 1900-2100",
    example: "2022",
    aliases: ["year", "anio", "ano"],
  },
  {
    name: "tipo",
    required: false,
    description:
      "Tipo de vehículo · auto, camión, moto, maquinaria pesada, trailer, silo. Default: genérico",
    example: "camión",
    aliases: ["vehicle_type", "vehicletype"],
  },
  {
    name: "movilidad",
    required: false,
    description: "Móvil o fijo · default: móvil",
    example: "móvil",
    aliases: ["mobility", "mobility_type"],
  },
  {
    name: "odometro",
    required: false,
    description:
      "Lectura del odómetro al momento del alta en km · útil para planes de mantenimiento",
    example: "125000",
    aliases: ["odometer", "kms", "km", "kilometraje"],
  },
];

function parseVehicleRow(
  raw: Record<string, string>,
  rowNumber: number,
): ParsedRow<VehicleImportRow> {
  const errors: { column: string; message: string }[] = [];

  const name = pickColumn(raw, "nombre", "name");
  const accountSlug = pickColumn(raw, "cliente", "account", "account_slug", "slug");
  const plate = pickColumn(raw, "patente", "plate", "license_plate", "dominio");
  const vin = pickColumn(raw, "vin", "chasis");
  const make = pickColumn(raw, "marca", "make");
  const model = pickColumn(raw, "modelo", "model");
  const yearStr = pickColumn(raw, "año", "year", "anio", "ano");
  const typeStr = pickColumn(raw, "tipo", "vehicle_type", "vehicletype");
  const mobilityStr = pickColumn(raw, "movilidad", "mobility", "mobility_type");
  const odometerStr = pickColumn(
    raw,
    "odometro",
    "odometer",
    "kms",
    "km",
    "kilometraje",
  );

  // Validaciones
  if (name.length === 0) {
    errors.push({ column: "nombre", message: "Requerido" });
  } else if (name.length > 80) {
    errors.push({ column: "nombre", message: "Máximo 80 caracteres" });
  }

  if (accountSlug.length === 0) {
    errors.push({ column: "cliente", message: "Requerido" });
  }

  if (plate.length > 0 && plate.length > 20) {
    errors.push({ column: "patente", message: "Máximo 20 caracteres" });
  }
  if (vin.length > 0 && vin.length > 30) {
    errors.push({ column: "vin", message: "Máximo 30 caracteres" });
  }

  let year: number | null = null;
  if (yearStr.length > 0) {
    const n = Number.parseInt(yearStr, 10);
    if (Number.isNaN(n) || n < 1900 || n > 2100) {
      errors.push({ column: "año", message: "Año inválido (1900-2100)" });
    } else {
      year = n;
    }
  }

  let initialOdometerKm: number | null = null;
  if (odometerStr.length > 0) {
    const n = Number.parseInt(odometerStr.replace(/[.,\s]/g, ""), 10);
    if (Number.isNaN(n) || n < 0 || n > 9_999_999) {
      errors.push({
        column: "odometro",
        message: "Valor inválido (0 - 9.999.999 km)",
      });
    } else {
      initialOdometerKm = n;
    }
  }

  // Resolver enum vehicle_type
  let vehicleType = "GENERIC";
  if (typeStr.length > 0) {
    const lower = typeStr.toLowerCase().trim();
    const mapped = VEHICLE_TYPE_MAP[lower];
    if (mapped) {
      vehicleType = mapped;
    } else if (VALID_VEHICLE_TYPES.includes(typeStr.toUpperCase())) {
      vehicleType = typeStr.toUpperCase();
    } else {
      errors.push({
        column: "tipo",
        message: `Tipo "${typeStr}" inválido · usá: auto, camión, moto, maquinaria pesada, trailer, silo`,
      });
    }
  }

  // Resolver enum mobility_type
  let mobilityType = "MOBILE";
  if (mobilityStr.length > 0) {
    const lower = mobilityStr.toLowerCase().trim();
    const mapped = MOBILITY_MAP[lower];
    if (mapped) {
      mobilityType = mapped;
    } else if (VALID_MOBILITY.includes(mobilityStr.toUpperCase())) {
      mobilityType = mobilityStr.toUpperCase();
    } else {
      errors.push({
        column: "movilidad",
        message: `Movilidad "${mobilityStr}" inválida · usá: móvil, fijo`,
      });
    }
  }

  if (errors.length > 0) {
    return { rowNumber, parsed: null, errors, raw };
  }

  return {
    rowNumber,
    parsed: {
      rowNumber,
      name,
      accountSlug,
      plate: plate.length > 0 ? plate : null,
      vin: vin.length > 0 ? vin : null,
      make: make.length > 0 ? make : null,
      model: model.length > 0 ? model : null,
      year,
      vehicleType,
      mobilityType,
      initialOdometerKm,
    },
    errors: [],
    raw,
  };
}

export function AdminVehiclesImporter() {
  return (
    <CsvImportDrawer<VehicleImportRow>
      entityName="vehículo"
      entityNamePlural="vehículos"
      templateColumns={TEMPLATE_COLUMNS}
      parseRow={parseVehicleRow}
      importRows={importVehicles}
      theme="dark"
    />
  );
}
