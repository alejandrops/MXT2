"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import styles from "./page.module.css";

export function NewClientButton() {
  const router = useRouter();

  function handleClick() {
    const url = new URL(window.location.href);
    url.searchParams.set("new", "1");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  return (
    <button type="button" className={styles.newBtn} onClick={handleClick}>
      <Plus size={14} />
      <span>Nuevo cliente</span>
    </button>
  );
}
