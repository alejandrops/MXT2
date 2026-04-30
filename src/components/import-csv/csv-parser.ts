// ═══════════════════════════════════════════════════════════════
//  csv-parser · cliente · sin deps externas
//  ─────────────────────────────────────────────────────────────
//  Parser de CSV minimal pero correcto para los casos que nos
//  importan:
//   · Separador "," o ";" (Excel argentino guarda con ;)
//   · Encoding UTF-8 con o sin BOM
//   · Quotes "..." con escape "" → "
//   · Campos vacíos preservados
//   · Líneas vacías ignoradas
//   · Saltos de línea \n o \r\n
//
//  No usamos PapaParse porque es ~50 KB de bundle innecesario
//  para esto. Suficiente con ~80 líneas custom.
// ═══════════════════════════════════════════════════════════════

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  /** Detectado automáticamente, útil para mostrar al usuario */
  delimiter: "," | ";";
  /** Cantidad total de líneas no vacías leídas (incluye header) */
  totalLines: number;
}

/**
 * Detecta el separador más probable mirando la primera línea.
 * Si hay más ; que , → ;. Default ,
 */
function detectDelimiter(firstLine: string): "," | ";" {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (c === ",") commas++;
      else if (c === ";") semis++;
    }
  }
  return semis > commas ? ";" : ",";
}

/**
 * Parsea una línea de CSV en campos respetando quotes.
 */
function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        // Escape "" → "
        if (line[i + 1] === '"') {
          buf += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      buf += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      out.push(buf);
      buf = "";
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  out.push(buf);
  return out.map((v) => v.trim());
}

export function parseCsv(text: string): CsvParseResult {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Normalizar saltos de línea
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: ",", totalLines: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().trim(),
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (fields[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows, delimiter, totalLines: lines.length };
}

/**
 * Resuelve un valor de la fila probando varias variantes del nombre
 * de columna. Devuelve la primera que tenga valor no-vacío.
 *
 * Útil porque los XLS de los clientes vienen con nombres distintos:
 *  - "patente" / "plate" / "license_plate" / "dominio"
 *  - "modelo" / "model"
 */
export function pickColumn(
  row: Record<string, string>,
  ...aliases: string[]
): string {
  for (const a of aliases) {
    const key = a.toLowerCase();
    const v = row[key];
    if (v !== undefined && v.trim().length > 0) return v.trim();
  }
  return "";
}

/**
 * Genera un CSV a partir de columnas + filas. Usado para descargar
 * el template y el log de errores.
 */
export function generateCsv(
  headers: string[],
  rows: string[][],
  delimiter: "," | ";" = ",",
): string {
  function escape(v: string): string {
    if (v.includes('"') || v.includes(delimiter) || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }
  const lines = [headers.map(escape).join(delimiter)];
  for (const r of rows) {
    lines.push(r.map(escape).join(delimiter));
  }
  return lines.join("\n");
}

/**
 * Triggea descarga de un blob de texto en el browser.
 */
export function downloadCsv(filename: string, content: string): void {
  // Prefix con BOM para que Excel reconozca UTF-8
  const blob = new Blob(["\ufeff" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
