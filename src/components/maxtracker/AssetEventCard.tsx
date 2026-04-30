import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AssetEventCountRow } from "@/lib/queries/safety";
import styles from "./AssetEventCard.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetEventCard
//  ─────────────────────────────────────────────────────────────
//  Single row in the "assets con más eventos" panel of the
//  Dashboard D right column. Clicking navigates to Libro B.
//
//  Visual strategy: keep the card minimal so the dashboard does
//  not become noisy. The number is the headline; the asset name
//  is secondary; the chevron hints at the navigation affordance.
// ═══════════════════════════════════════════════════════════════

interface AssetEventCardProps {
  asset: AssetEventCountRow;
}

export function AssetEventCard({ asset }: AssetEventCardProps) {
  return (
    <Link
      href={`/catalogos/vehiculos/${asset.id}`}
      className={styles.card}
    >
      <div className={styles.body}>
        <div className={styles.name}>{asset.name}</div>
        {asset.plate && <div className={styles.plate}>{asset.plate}</div>}
      </div>
      <div className={styles.right}>
        <span className={styles.count}>{asset.eventCount30d}</span>
        <span className={styles.label}>eventos</span>
      </div>
      <ChevronRight size={14} className={styles.chev} />
    </Link>
  );
}
