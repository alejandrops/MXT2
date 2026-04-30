"use client";

import { CsvImportDrawer } from "@/components/import-csv/CsvImportDrawer";
import { pickColumn } from "@/components/import-csv/csv-parser";
import type {
  TemplateColumn,
  ParsedRow,
} from "@/components/import-csv/types";
import { importDrivers, type DriverImportRow } from "./import-actions";

// ═══════════════════════════════════════════════════════════════
//  AdminDriversImporter · drawer dark theme · cross-cliente
// ═══════════════════════════════════════════════════════════════

const TEMPLATE_COLUMNS: TemplateColumn[] = [
  {
    name: "nombre",
    required: true,
    description: "Nombre de pila del conductor · ej Juan, María",
    example: "Juan",
    aliases: ["first_name", "firstname", "nombres"],
  },
  {
    name: "apellido",
    required: true,
    description: "Apellido · ej Pérez, González",
    example: "Pérez",
    aliases: ["last_name", "lastname", "apellidos"],
  },
  {
    name: "cliente",
    required: true,
    description:
      "Slug del cliente al que pertenece · ej transportes-del-sur. Lo encontrás en /admin/clientes.",
    example: "transportes-del-sur",
    aliases: ["account", "account_slug", "slug"],
  },
  {
    name: "documento",
    required: false,
    description:
      "Documento de identidad · DNI ARG, RUT CL, etc · 30 caracteres máx. Puede repetirse entre clientes (no entre el mismo cliente).",
    example: "32145678",
    aliases: ["document", "dni", "rut", "documento_identidad"],
  },
  {
    name: "licencia_vence",
    required: false,
    description:
      "Fecha de vencimiento del registro / licencia · formato YYYY-MM-DD",
    example: "2026-08-15",
    aliases: ["license_expires_at", "license_expires", "vence_licencia"],
  },
  {
    name: "fecha_contrato",
    required: false,
    description:
      "Fecha en que fue contratado por este cliente · formato YYYY-MM-DD",
    example: "2024-03-01",
    aliases: ["hired_at", "hired_date", "fecha_alta", "alta"],
  },
];

function parseDriverRow(
  raw: Record<string, string>,
  rowNumber: number,
): ParsedRow<DriverImportRow> {
  const errors: { column: string; message: string }[] = [];

  const firstName = pickColumn(
    raw,
    "nombre",
    "first_name",
    "firstname",
    "nombres",
  );
  const lastName = pickColumn(
    raw,
    "apellido",
    "last_name",
    "lastname",
    "apellidos",
  );
  const accountSlug = pickColumn(
    raw,
    "cliente",
    "account",
    "account_slug",
    "slug",
  );
  const document = pickColumn(
    raw,
    "documento",
    "document",
    "dni",
    "rut",
    "documento_identidad",
  );
  const licenseStr = pickColumn(
    raw,
    "licencia_vence",
    "license_expires_at",
    "license_expires",
    "vence_licencia",
  );
  const hiredStr = pickColumn(
    raw,
    "fecha_contrato",
    "hired_at",
    "hired_date",
    "fecha_alta",
    "alta",
  );

  if (firstName.length === 0) {
    errors.push({ column: "nombre", message: "Requerido" });
  } else if (firstName.length > 60) {
    errors.push({ column: "nombre", message: "Máximo 60 caracteres" });
  }

  if (lastName.length === 0) {
    errors.push({ column: "apellido", message: "Requerido" });
  } else if (lastName.length > 60) {
    errors.push({ column: "apellido", message: "Máximo 60 caracteres" });
  }

  if (accountSlug.length === 0) {
    errors.push({ column: "cliente", message: "Requerido" });
  }

  if (document.length > 30) {
    errors.push({ column: "documento", message: "Máximo 30 caracteres" });
  }

  // Validación liviana de fechas · formato YYYY-MM-DD (la conversión
  // estricta a Date ocurre en el server action).
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (licenseStr.length > 0 && !isoDateRegex.test(licenseStr)) {
    errors.push({
      column: "licencia_vence",
      message: "Formato inválido · usar YYYY-MM-DD",
    });
  }
  if (hiredStr.length > 0 && !isoDateRegex.test(hiredStr)) {
    errors.push({
      column: "fecha_contrato",
      message: "Formato inválido · usar YYYY-MM-DD",
    });
  }

  if (errors.length > 0) {
    return { rowNumber, parsed: null, errors, raw };
  }

  return {
    rowNumber,
    parsed: {
      rowNumber,
      firstName,
      lastName,
      accountSlug,
      document: document.length > 0 ? document : null,
      licenseExpiresAt: licenseStr.length > 0 ? licenseStr : null,
      hiredAt: hiredStr.length > 0 ? hiredStr : null,
    },
    errors: [],
    raw,
  };
}

export function AdminDriversImporter() {
  return (
    <CsvImportDrawer<DriverImportRow>
      entityName="conductor"
      entityNamePlural="conductores"
      templateColumns={TEMPLATE_COLUMNS}
      parseRow={parseDriverRow}
      importRows={importDrivers}
      theme="dark"
    />
  );
}
