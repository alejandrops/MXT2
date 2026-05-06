"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { HelpDrawer } from "./HelpDrawer";
import styles from "./HelpButton.module.css";

// ═══════════════════════════════════════════════════════════════
//  HelpButton · S6-WIKI
//  ─────────────────────────────────────────────────────────────
//  Botón con ícono "?" en el header de cada vista. Al click
//  abre el HelpDrawer asociado al slug de la vista.
//
//  Uso típico desde PageHeader:
//    <HelpButton slug="conduccion/scorecard" />
//
//  El slug debe coincidir con el path del archivo MDX en
//  docs/wiki/{slug}.mdx (sin la extensión).
// ═══════════════════════════════════════════════════════════════

interface Props {
  slug: string;
  /** label para tooltip · default "Ayuda de esta pantalla" */
  label?: string;
}

export function HelpButton({ slug, label = "Ayuda de esta pantalla" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={styles.btn}
        title={label}
        aria-label={label}
      >
        <HelpCircle size={14} />
      </button>
      <HelpDrawer
        open={open}
        slug={slug}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
