"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  parseCsv,
  generateCsv,
  downloadCsv,
} from "./csv-parser";
import type {
  TemplateColumn,
  ParsedRow,
  ImportResult,
} from "./types";
import styles from "./CsvImportDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  CsvImportDrawer · drawer reutilizable para importar CSV/XLS
//  ─────────────────────────────────────────────────────────────
//  Flujo en 4 fases:
//
//   1. UPLOAD · drop zone + botón "Descargar template"
//   2. PREVIEW · primeras 50 filas, errores marcados
//                Resumen: "47 OK · 3 con errores · 50 total"
//                Botón "Importar 47 válidos" (omite los inválidos)
//   3. IMPORTING · indicador, llamada al server action
//   4. RESULT · X creados, Y omitidos, link "Descargar log"
//
//  El componente NO conoce el dominio. Recibe un config con:
//   · entityName (label, ej "vehículos")
//   · templateColumns (para descargar el template y mostrar
//                      qué columnas espera)
//   · parseRow (función que convierte una fila cruda en objeto
//               + errores)
//   · importRows (server action que recibe los objetos válidos)
// ═══════════════════════════════════════════════════════════════

interface Props<T> {
  entityName: string;
  entityNamePlural: string;
  templateColumns: TemplateColumn[];
  parseRow: (
    raw: Record<string, string>,
    rowNumber: number,
  ) => ParsedRow<T>;
  importRows: (rows: T[]) => Promise<ImportResult>;
  /** Theme · "dark" para /admin, "light" para /(product) */
  theme?: "dark" | "light";
}

type Phase = "upload" | "preview" | "importing" | "result";

export function CsvImportDrawer<T>({
  entityName,
  entityNamePlural,
  templateColumns,
  parseRow,
  importRows,
  theme = "light",
}: Props<T>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow<T>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("import");
    router.push(url.pathname + url.search, { scroll: false });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    try {
      const text = await file.text();
      const csv = parseCsv(text);

      if (csv.headers.length === 0) {
        setParseError("El archivo está vacío.");
        return;
      }
      if (csv.rows.length === 0) {
        setParseError("El archivo no tiene filas de datos.");
        return;
      }

      const parsed: ParsedRow<T>[] = csv.rows.map((row, idx) =>
        parseRow(row, idx + 1),
      );
      setParsedRows(parsed);
      setPhase("preview");
    } catch (err) {
      setParseError(
        err instanceof Error
          ? `Error leyendo el archivo: ${err.message}`
          : "Error leyendo el archivo.",
      );
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function downloadTemplate() {
    const headers = templateColumns.map(
      (c) => `${c.name}${c.required ? " *" : ""}`,
    );
    const exampleRow = templateColumns.map((c) => c.example);
    const content = generateCsv(headers, [exampleRow], ",");
    downloadCsv(`template-${entityName.toLowerCase()}.csv`, content);
  }

  function downloadErrorLog() {
    if (!result) return;
    const headers = ["Fila", "Columna", "Error"];
    const rows = result.errors.map((e) => [
      String(e.rowNumber),
      e.column ?? "",
      e.message,
    ]);
    const content = generateCsv(headers, rows, ",");
    downloadCsv(`errores-import-${entityName.toLowerCase()}.csv`, content);
  }

  function handleImport() {
    const valid = parsedRows.filter((p) => p.parsed !== null && p.errors.length === 0);
    const validData = valid.map((p) => p.parsed as T);

    setPhase("importing");
    startTransition(async () => {
      try {
        const r = await importRows(validData);
        setResult(r);
        setPhase("result");
        if (r.ok && r.created > 0) {
          router.refresh();
        }
      } catch (err) {
        setResult({
          ok: false,
          created: 0,
          skipped: validData.length,
          errors: [
            {
              rowNumber: 0,
              message:
                err instanceof Error ? err.message : "Error inesperado",
            },
          ],
          message: "La importación falló.",
        });
        setPhase("result");
      }
    });
  }

  function reset() {
    setPhase("upload");
    setParsedRows([]);
    setFileName("");
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const okCount = parsedRows.filter(
    (p) => p.parsed !== null && p.errors.length === 0,
  ).length;
  const errorCount = parsedRows.length - okCount;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside
        className={`${styles.drawer} ${theme === "dark" ? styles.drawerDark : styles.drawerLight}`}
        role="dialog"
        aria-label={`Importar ${entityNamePlural} desde CSV`}
      >
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              Importar {entityNamePlural} desde CSV
            </span>
            {fileName && phase !== "upload" && (
              <span className={styles.headerName}>
                <FileSpreadsheet size={13} className={styles.fileIcon} />
                {fileName}
              </span>
            )}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>

        <div className={styles.body}>
          {/* ── Phase 1 · UPLOAD ──────────────────────────── */}
          {phase === "upload" && (
            <>
              <div
                className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={28} className={styles.uploadIcon} />
                <span className={styles.dropTitle}>
                  Arrastrá un archivo CSV
                </span>
                <span className={styles.dropSub}>
                  o hacé click para seleccionarlo de tu computadora
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>

              {parseError && (
                <div className={styles.alert}>{parseError}</div>
              )}

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Plantilla</h3>
                <p className={styles.sectionHint}>
                  Descargá el archivo template con las columnas y un ejemplo
                  de fila. Tu CSV puede tener columnas adicionales · las
                  ignoramos. Los nombres son flexibles · aceptamos español
                  e inglés.
                </p>
                <button
                  type="button"
                  className={styles.templateBtn}
                  onClick={downloadTemplate}
                >
                  <Download size={13} />
                  <span>Descargar template CSV</span>
                </button>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Columnas esperadas</h3>
                <table className={styles.colsTable}>
                  <thead>
                    <tr>
                      <th className={styles.colsTh}>Columna</th>
                      <th className={styles.colsTh}>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateColumns.map((c) => (
                      <tr key={c.name}>
                        <td className={styles.colsTd}>
                          <span className={styles.colName}>
                            {c.name}
                            {c.required && (
                              <span className={styles.required}> *</span>
                            )}
                          </span>
                          {c.aliases && c.aliases.length > 0 && (
                            <span className={styles.colAliases}>
                              también: {c.aliases.join(", ")}
                            </span>
                          )}
                        </td>
                        <td className={styles.colsTd}>
                          <span className={styles.colDesc}>{c.description}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={styles.legend}>
                  <span className={styles.required}>*</span> = columna requerida
                </p>
              </div>
            </>
          )}

          {/* ── Phase 2 · PREVIEW ──────────────────────────── */}
          {phase === "preview" && (
            <>
              <div className={styles.summary}>
                <div className={styles.summaryStats}>
                  <div className={styles.summaryStat}>
                    <span className={styles.summaryValue}>
                      {parsedRows.length}
                    </span>
                    <span className={styles.summaryLabel}>filas leídas</span>
                  </div>
                  <div
                    className={`${styles.summaryStat} ${styles.summaryOk}`}
                  >
                    <CheckCircle2 size={14} />
                    <span className={styles.summaryValue}>{okCount}</span>
                    <span className={styles.summaryLabel}>válidas</span>
                  </div>
                  {errorCount > 0 && (
                    <div
                      className={`${styles.summaryStat} ${styles.summaryError}`}
                    >
                      <XCircle size={14} />
                      <span className={styles.summaryValue}>{errorCount}</span>
                      <span className={styles.summaryLabel}>con errores</span>
                    </div>
                  )}
                </div>

                {errorCount > 0 && (
                  <div className={styles.warnNote}>
                    <AlertTriangle size={13} />
                    <span>
                      Las filas con errores no se van a importar. Corregí
                      el archivo y volvé a subirlo, o seguí adelante para
                      importar solo las válidas.
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.previewWrap}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th className={styles.previewTh}>#</th>
                      <th className={styles.previewTh}>Estado</th>
                      {templateColumns.slice(0, 5).map((c) => (
                        <th key={c.name} className={styles.previewTh}>
                          {c.name}
                        </th>
                      ))}
                      <th className={styles.previewTh}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((p) => {
                      const hasErrors = p.errors.length > 0;
                      return (
                        <tr
                          key={p.rowNumber}
                          className={hasErrors ? styles.rowError : ""}
                        >
                          <td className={styles.previewTd}>
                            <span className={styles.mono}>{p.rowNumber}</span>
                          </td>
                          <td className={styles.previewTd}>
                            {hasErrors ? (
                              <XCircle
                                size={13}
                                className={styles.errorIcon}
                              />
                            ) : (
                              <CheckCircle2
                                size={13}
                                className={styles.okIcon}
                              />
                            )}
                          </td>
                          {templateColumns.slice(0, 5).map((c) => {
                            const value = p.raw[c.name.toLowerCase()] ?? "";
                            const colError = p.errors.find(
                              (e) =>
                                e.column.toLowerCase() ===
                                c.name.toLowerCase(),
                            );
                            return (
                              <td
                                key={c.name}
                                className={`${styles.previewTd} ${colError ? styles.cellError : ""}`}
                              >
                                {value || (
                                  <span className={styles.emptyCell}>—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className={styles.previewTd}>
                            {p.errors.length > 0 ? (
                              <span className={styles.errorList}>
                                {p.errors
                                  .map((e) => `${e.column}: ${e.message}`)
                                  .join(" · ")}
                              </span>
                            ) : (
                              <span className={styles.dim}>OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {parsedRows.length > 50 && (
                  <div className={styles.previewMore}>
                    Mostrando las primeras 50 filas · {parsedRows.length - 50}{" "}
                    más en el archivo
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Phase 3 · IMPORTING ─────────────────────── */}
          {phase === "importing" && (
            <div className={styles.importing}>
              <div className={styles.spinner} />
              <span className={styles.importingTitle}>
                Importando {okCount} {entityNamePlural}…
              </span>
              <span className={styles.importingHint}>
                Esto puede tardar unos segundos
              </span>
            </div>
          )}

          {/* ── Phase 4 · RESULT ────────────────────────── */}
          {phase === "result" && result && (
            <>
              <div
                className={`${styles.resultBanner} ${
                  result.ok ? styles.resultBannerOk : styles.resultBannerError
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 size={20} className={styles.resultIcon} />
                ) : (
                  <XCircle size={20} className={styles.resultIcon} />
                )}
                <div className={styles.resultContent}>
                  <strong className={styles.resultTitle}>
                    {result.ok
                      ? `${result.created} ${entityNamePlural} ${result.created === 1 ? "creado" : "creados"}`
                      : "La importación falló"}
                  </strong>
                  {result.skipped > 0 && (
                    <span className={styles.resultDetail}>
                      {result.skipped} {result.skipped === 1 ? "fila" : "filas"} omitidas por errores
                    </span>
                  )}
                  {result.message && (
                    <span className={styles.resultDetail}>
                      {result.message}
                    </span>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    Errores ({result.errors.length})
                  </h3>
                  <button
                    type="button"
                    className={styles.templateBtn}
                    onClick={downloadErrorLog}
                  >
                    <Download size={13} />
                    <span>Descargar log de errores</span>
                  </button>
                  <ul className={styles.errorListUl}>
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i} className={styles.errorListItem}>
                        <span className={styles.mono}>
                          Fila {e.rowNumber}
                        </span>
                        {e.column && <span> · {e.column}</span>}
                        <span> · {e.message}</span>
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className={styles.errorListMore}>
                        + {result.errors.length - 10} más · descargá el log
                        para ver todos
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <footer className={styles.footer}>
          {phase === "upload" && (
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancelar
            </button>
          )}
          {phase === "preview" && (
            <>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={reset}
              >
                Volver
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleImport}
                disabled={okCount === 0 || isPending}
              >
                {okCount === 0
                  ? "No hay filas válidas"
                  : `Importar ${okCount} ${okCount === 1 ? entityName : entityNamePlural}`}
              </button>
            </>
          )}
          {phase === "importing" && (
            <button
              type="button"
              className={styles.cancelBtn}
              disabled
            >
              Importando…
            </button>
          )}
          {phase === "result" && (
            <>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={reset}
              >
                Importar otro archivo
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={onClose}
              >
                Listo
              </button>
            </>
          )}
        </footer>
      </aside>
    </>
  );
}
