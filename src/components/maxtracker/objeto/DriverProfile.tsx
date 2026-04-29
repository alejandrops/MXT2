import type { DriverProfileData } from "@/lib/queries/driver-profile";
import styles from "./DriverProfile.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverProfile · header slot del Libro Conductor
//  ─────────────────────────────────────────────────────────────
//  Igual rol que LiveStatus para vehículo · tira de información
//  persistente que no cambia con el período seleccionado.
//
//  Estructura:
//    1. Banner (solo si hay) · alerta de licencia vencida o
//       próxima a vencer
//    2. Fila de datos · documento, antigüedad, licencia,
//       safety score con contexto, vehículos asignados
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: DriverProfileData;
}

export function DriverProfile({ data }: Props) {
  return (
    <div className={styles.wrap}>
      {/* ── Banner de alerta de licencia ────────────────────── */}
      {data.licenseExpired && (
        <div className={`${styles.banner} ${styles.bannerCritical}`}>
          <span className={styles.bannerTitle}>Licencia vencida</span>
          <span className={styles.bannerHint}>
            · vencida el {fmtDate(data.licenseExpiresAt)}
          </span>
        </div>
      )}
      {!data.licenseExpired && data.licenseExpiringSoon && (
        <div className={`${styles.banner} ${styles.bannerWarn}`}>
          <span className={styles.bannerTitle}>Licencia próxima a vencer</span>
          <span className={styles.bannerHint}>
            · vence el {fmtDate(data.licenseExpiresAt)}
          </span>
        </div>
      )}

      {/* ── Fila de datos · 5 celdas ─────────────────────────── */}
      <div className={styles.row}>
        <Cell label="Documento" value={data.document ?? "—"} mono />
        <Cell label="Antigüedad" value={hiredLabel(data.hiredAt)} />
        <Cell
          label="Licencia"
          value={data.licenseExpiresAt ? fmtDate(data.licenseExpiresAt) : "—"}
        />
        <Cell
          label="Safety score"
          value={`${data.safetyScore}`}
          hint={data.scoreContext}
        />
        <Cell
          label="Vehículos asignados"
          value={data.drivenAssetCount.toString()}
          grow
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-component
// ═══════════════════════════════════════════════════════════════

function Cell({
  label,
  value,
  hint,
  mono,
  grow,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  grow?: boolean;
}) {
  return (
    <div className={`${styles.cell} ${grow ? styles.cellGrow : ""}`}>
      <span className={styles.cellLabel}>{label}</span>
      <span className={styles.cellValueWrap}>
        <span className={`${styles.cellValue} ${mono ? styles.mono : ""}`}>
          {value}
        </span>
        {hint && <span className={styles.cellHint}>· {hint}</span>}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function hiredLabel(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const years = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(ms / (30.5 * 24 * 60 * 60 * 1000));
  if (years >= 1) {
    return years === 1 ? "1 año" : `${years} años`;
  }
  if (months >= 1) {
    return months === 1 ? "1 mes" : `${months} meses`;
  }
  return "menos de 1 mes";
}
