"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import styles from "./AccountSwitcher.module.css";

// ═══════════════════════════════════════════════════════════════
//  AccountSwitcher · selector de cuenta para SA/MA
//  ─────────────────────────────────────────────────────────────
//  Muestra la cuenta actual + dropdown con todas las cuentas
//  de la organización. Al elegir una, agrega ?account=<id> a la
//  URL · navegación cliente preserva la sección activa.
//
//  Para CA · este componente NO se renderea (page.tsx solo lo
//  monta para isPlatformAdmin).
// ═══════════════════════════════════════════════════════════════

interface AccountOption {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  accounts: AccountOption[];
  currentAccountId: string | null;
}

export function AccountSwitcher({ accounts, currentAccountId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Cerrar al click fuera o Escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = accounts.find((a) => a.id === currentAccountId) ?? accounts[0];

  if (!current) {
    return (
      <div className={styles.empty}>
        <Building2 size={14} />
        <span>Sin cuentas disponibles</span>
      </div>
    );
  }

  function handleSelect(accountId: string) {
    setOpen(false);
    // Preservar section actual · solo cambiar el account
    const params = new URLSearchParams(searchParams.toString());
    params.set("account", accountId);
    router.push(`/configuracion?${params.toString()}`);
  }

  return (
    <div className={styles.wrap} ref={ref}>
      <div className={styles.label}>Viendo cuenta</div>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Building2 size={14} className={styles.triggerIcon} />
        <span className={styles.triggerName}>{current.name}</span>
        <ChevronDown
          size={13}
          className={`${styles.triggerChev} ${open ? styles.triggerChevOpen : ""}`}
        />
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          {accounts.map((acc) => {
            const isActive = acc.id === current.id;
            return (
              <button
                key={acc.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
                onClick={() => handleSelect(acc.id)}
              >
                <span className={styles.itemName}>{acc.name}</span>
                {isActive && <Check size={13} className={styles.itemCheck} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
