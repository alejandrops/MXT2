"use client";

import { ChevronLeft } from "lucide-react";
import {
  useBackLabel,
  useBackNavigation,
} from "@/hooks/useBackNavigation";
import styles from "./BackButton.module.css";

// ═══════════════════════════════════════════════════════════════
//  BackButton · L4
//  ─────────────────────────────────────────────────────────────
//  Botón "Volver" que va al lugar de origen real (último entry
//  del stack en sessionStorage). Si el stack está vacío, va al
//  `fallbackUrl` definido por la página.
//
//  El label es dinámico:
//   · Si la página de origen pasó un label en su useTrackPageIn-
//     BackStack, ese label se usa ("Volver a Flota Norte").
//   · Si no, se usa el `defaultLabel` que pasa esta pantalla
//     ("Volver a Vehículos").
//
//  Props:
//   · fallbackUrl · URL a la que ir si el stack está vacío.
//   · defaultLabel · Label si la origen no pasó label propio.
//
//  Reemplaza al patrón `<Link href="/lista">Volver a Lista</Link>`
//  hardcoded · ese va a la lista incluso si veniste de un grupo.
// ═══════════════════════════════════════════════════════════════

interface Props {
  fallbackUrl: string;
  defaultLabel: string;
  /** Override visual · si querés un label fijo sin lookup del stack */
  forceLabel?: string;
}

export function BackButton({ fallbackUrl, defaultLabel, forceLabel }: Props) {
  const goBack = useBackNavigation(fallbackUrl);
  const dynamicLabel = useBackLabel(defaultLabel);
  const label = forceLabel ?? dynamicLabel;

  return (
    <button type="button" className={styles.back} onClick={goBack}>
      <ChevronLeft size={13} />
      {label}
    </button>
  );
}
