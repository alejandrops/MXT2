"use client";

import { useRouter } from "next/navigation";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  ProfileEditTrigger · botón que abre el drawer del perfil
//  Server-friendly · solo el click es client
// ═══════════════════════════════════════════════════════════════

interface Props {
  profileId: string;
  label: string;
  icon: React.ReactNode;
}

export function ProfileEditTrigger({ profileId, label, icon }: Props) {
  const router = useRouter();

  function handleClick() {
    const url = new URL(window.location.href);
    url.searchParams.set("edit", profileId);
    router.push(url.pathname + url.search, { scroll: false });
  }

  return (
    <button type="button" className={styles.editBtn} onClick={handleClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
