import Link from "next/link";
import { ChevronLeft, User, MapPin, Building2, Layers } from "lucide-react";
import { StatusPill } from "./StatusPill";
import { relativeTime } from "@/lib/format";
import type { AssetDetail } from "@/types/domain";
import styles from "./AssetHeader.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetHeader
//  ─────────────────────────────────────────────────────────────
//  Top of Libro B. Combines:
//    · Back link to /seguridad
//    · Primary identity (name, plate, vehicle)
//    · Right-side: status pill + last seen
//    · Bottom row: account · group · driver · last seen
//
//  Uses StatusPill for consistency with Lista A.
// ═══════════════════════════════════════════════════════════════

interface AssetHeaderProps {
  asset: AssetDetail;
}

export function AssetHeader({ asset }: AssetHeaderProps) {
  const driver = asset.currentDriver;
  const subtitleParts = [
    asset.plate,
    asset.make && asset.model ? `${asset.make} ${asset.model}` : null,
    asset.year ? String(asset.year) : null,
  ].filter(Boolean) as string[];

  return (
    <header className={styles.header}>
      <Link href="/catalogos/vehiculos" className={styles.backLink}>
        <ChevronLeft size={13} />
        Volver a Vehículos
      </Link>

      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{asset.name}</h1>
          {subtitleParts.length > 0 && (
            <p className={styles.subtitle}>{subtitleParts.join(" · ")}</p>
          )}
        </div>
        <div className={styles.statusBlock}>
          <StatusPill status={asset.status} />
          {asset.lastPosition && (
            <span className={styles.lastSeen}>
              Última señal · {relativeTime(asset.lastPosition.recordedAt)}
            </span>
          )}
        </div>
      </div>

      <div className={styles.metaRow}>
        <MetaItem
          icon={<Building2 size={11} />}
          label="Cuenta"
          value={asset.account.name}
        />
        <MetaItem
          icon={<Layers size={11} />}
          label="Grupo"
          value={asset.group?.name ?? "Sin grupo"}
        />
        <MetaItem
          icon={<User size={11} />}
          label="Conductor"
          value={
            driver
              ? `${driver.firstName} ${driver.lastName}`
              : "Sin asignar"
          }
        />
        {asset.lastPosition && (
          <MetaItem
            icon={<MapPin size={11} />}
            label="Posición"
            value={`${asset.lastPosition.lat.toFixed(4)}, ${asset.lastPosition.lng.toFixed(4)}`}
            mono
          />
        )}
      </div>
    </header>
  );
}

function MetaItem({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className={styles.metaItem}>
      <span className={styles.metaIcon}>{icon}</span>
      <span className={styles.metaLabel}>{label}</span>
      <span className={`${styles.metaValue} ${mono ? styles.mono : ""}`}>
        {value}
      </span>
    </div>
  );
}
