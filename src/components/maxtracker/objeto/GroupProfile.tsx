import type { GroupProfileData } from "@/lib/queries/group-profile";
import styles from "./DriverProfile.module.css";

// ═══════════════════════════════════════════════════════════════
//  GroupProfile · header slot del Libro Grupo
//  ─────────────────────────────────────────────────────────────
//  Reusa el CSS de DriverProfile (mismo layout y semántica).
//  Cantidades del grupo y composición de la jerarquía.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: GroupProfileData;
}

export function GroupProfile({ data }: Props) {
  // % de cobertura · vehículos con conductor sobre total
  const coveragePct =
    data.assetCount > 0
      ? Math.round((data.assetsWithDriver / data.assetCount) * 100)
      : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <Cell label="Vehículos" value={data.assetCount.toString()} />
        <Cell
          label="Con conductor"
          value={`${data.assetsWithDriver}`}
          hint={`${coveragePct}% cobertura`}
        />
        <Cell label="Conductores únicos" value={data.uniqueDriversCount.toString()} />
        {data.parentName && (
          <Cell label="Grupo padre" value={data.parentName} />
        )}
        {data.childrenCount > 0 && (
          <Cell
            label="Subgrupos"
            value={data.childrenCount.toString()}
            grow
          />
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  hint,
  grow,
}: {
  label: string;
  value: string;
  hint?: string;
  grow?: boolean;
}) {
  return (
    <div className={`${styles.cell} ${grow ? styles.cellGrow : ""}`}>
      <span className={styles.cellLabel}>{label}</span>
      <span className={styles.cellValueWrap}>
        <span className={styles.cellValue}>{value}</span>
        {hint && <span className={styles.cellHint}>· {hint}</span>}
      </span>
    </div>
  );
}
