import Link from "next/link";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverCell · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  Nombre del conductor con link al libro. "—" si no hay
//  conductor asignado (caso común en eventos sin chofer).
// ═══════════════════════════════════════════════════════════════

interface Props {
  person: {
    id: string;
    name: string;
  } | null | undefined;
  linkable?: boolean;
}

export function DriverCell({ person, linkable = true }: Props) {
  if (!person) {
    return <span className={styles.muted}>—</span>;
  }

  if (!linkable) {
    return <span className={styles.driverName}>{person.name}</span>;
  }

  return (
    <Link
      href={`/objeto/conductor/${person.id}`}
      className={`${styles.link} ${styles.driverLink}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className={styles.driverName}>{person.name}</span>
    </Link>
  );
}
