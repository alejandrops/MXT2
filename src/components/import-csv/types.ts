// ═══════════════════════════════════════════════════════════════
//  Tipos compartidos del importador genérico
// ═══════════════════════════════════════════════════════════════

export interface TemplateColumn {
  /** Nombre canónico de la columna (lo que va en el header) */
  name: string;
  /** Si es requerida · marcamos con * en el template */
  required: boolean;
  /** Descripción que va en una segunda fila tipo "comentario" */
  description: string;
  /** Ejemplo de valor para el template */
  example: string;
  /** Aliases adicionales aceptados (para tolerar XLS con headers distintos) */
  aliases?: string[];
}

/**
 * Resultado de parsear UNA fila del CSV en una entidad concreta.
 * Si hay errores, parsed va vacío y errors detalla los problemas
 * de esa fila para que el usuario los vea en el preview.
 */
export interface ParsedRow<T> {
  /** Número de fila en el CSV original (1-indexed, sin contar header) */
  rowNumber: number;
  /** El objeto parseado · null si tiene errores que impiden importar */
  parsed: T | null;
  /** Lista de errores de validación de la fila · vacío = OK */
  errors: { column: string; message: string }[];
  /** Datos crudos para mostrar en el preview · siempre presente */
  raw: Record<string, string>;
}

/**
 * Resultado de la operación de import server-side.
 */
export interface ImportResult {
  ok: boolean;
  created: number;
  skipped: number;
  /** Errores que el server detectó (ej · IMEI ya existe en DB) */
  errors: { rowNumber: number; column?: string; message: string }[];
  /** Mensaje general (éxito o falla) */
  message?: string;
}
