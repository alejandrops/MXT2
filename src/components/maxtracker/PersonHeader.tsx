import Link from "next/link";
import { ChevronLeft, Building2, IdCard, Truck } from "lucide-react";
import { initials, relativeTime } from "@/lib/format";
import type { PersonDetail } from "@/types/domain";
import styles from "./PersonHeader.module.css";

// ═══════════════════════════════════════════════════════════════
//  PersonHeader · Sub-lote 3.3
//  ─────────────────────────────────────────────────────────────
//  Top of Libro del Conductor (Patrón B). Mirrors AssetHeader.
//
//  Composition:
//    · Back link to /seguridad
//    · Title row: avatar + name + subtitle on left,
//      score badge + last activity on right
//    · Meta row: account · license expiration · driven assets
//
//  Score band colors:
//    < 60   → red    (CRÍTICO)
//    60–79  → amber  (CAUCIÓN)
//    ≥ 80   → green  (OK)
// ═══════════════════════════════════════════════════════════════

interface PersonHeaderProps {
  person: PersonDetail;
}

export function PersonHeader({ person }: PersonHeaderProps) {
  const fullName = `${person.firstName} ${person.lastName}`;
  const subtitleParts = [
    person.document ? `DNI ${person.document}` : null,
    person.hiredAt
      ? `Ingresó ${person.hiredAt.toLocaleDateString("es-AR", {
          year: "numeric",
          month: "short",
        })}`
      : null,
  ].filter(Boolean) as string[];

  const score = person.safetyScore;
  const scoreClass =
    score < 60
      ? styles.scoreCritical
      : score < 80
        ? styles.scoreWarn
        : styles.scoreOk;
  const scoreLabel =
    score < 60 ? "CRÍTICO" : score < 80 ? "CAUCIÓN" : "OK";

  const licenseExpiringSoon =
    person.licenseExpiresAt &&
    person.licenseExpiresAt.getTime() - Date.now() < 60 * 24 * 60 * 60 * 1000;

  return (
    <header className={styles.header}>
      <Link href="/seguridad/dashboard" className={styles.backLink}>
        <ChevronLeft size={13} />
        Volver al Dashboard
      </Link>

      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <div className={styles.avatar}>
            {initials(person.firstName, person.lastName)}
          </div>
          <div className={styles.nameBlock}>
            <h1 className={styles.name}>{fullName}</h1>
            {subtitleParts.length > 0 && (
              <div className={styles.subtitle}>{subtitleParts.join(" · ")}</div>
            )}
          </div>
        </div>

        <div className={styles.statusBlock}>
          <div className={`${styles.scoreBadge} ${scoreClass}`}>
            <span className={styles.scoreNum}>{score}</span>
            <span className={styles.scoreLabel}>{scoreLabel}</span>
          </div>
          {person.stats.lastEventAt && (
            <div className={styles.lastSeen}>
              Última actividad · {relativeTime(person.stats.lastEventAt)}
            </div>
          )}
        </div>
      </div>

      {/* ── Meta row ──────────────────────────────────────────── */}
      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <Building2 size={11} />
          <span className={styles.metaLabel}>Cuenta</span>
          <span className={styles.metaValue}>{person.account.name}</span>
        </span>

        <span className={styles.metaItem}>
          <IdCard size={11} />
          <span className={styles.metaLabel}>Licencia</span>
          <span
            className={`${styles.metaValue} ${
              licenseExpiringSoon ? styles.metaValueWarn : ""
            }`}
          >
            {person.licenseExpiresAt
              ? person.licenseExpiresAt.toLocaleDateString("es-AR")
              : "Sin registro"}
          </span>
        </span>

        <span className={styles.metaItem}>
          <Truck size={11} />
          <span className={styles.metaLabel}>Maneja</span>
          <span className={styles.metaValue}>
            {person.drivenAssets.length === 0
              ? "Sin assignación"
              : person.drivenAssets
                  .map((a) => `${a.name}${a.plate ? ` (${a.plate})` : ""}`)
                  .join(" · ")}
          </span>
        </span>
      </div>
    </header>
  );
}
