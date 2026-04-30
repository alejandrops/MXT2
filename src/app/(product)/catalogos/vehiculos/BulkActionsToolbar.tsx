"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Folder,
  UserCircle2,
  Activity,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  bulkAssignDriver,
  bulkChangeStatus,
  bulkMoveToGroup,
  bulkSoftDelete,
} from "./actions";
import styles from "./BulkActionsToolbar.module.css";

// ═══════════════════════════════════════════════════════════════
//  BulkActionsToolbar · barra que aparece arriba cuando hay
//  ≥1 vehículo seleccionado.
//  ─────────────────────────────────────────────────────────────
//  4 acciones:
//    · Mover a grupo (popover con select)
//    · Asignar conductor (popover con select)
//    · Cambiar estado (popover con select de status)
//    · Dar de baja (confirmación)
//
//  Cuando una acción se completa: refresh + clearSelection.
// ═══════════════════════════════════════════════════════════════

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "MOVING", label: "En movimiento" },
  { value: "IDLE", label: "Detenido" },
  { value: "STOPPED", label: "Apagado" },
  { value: "OFFLINE", label: "Sin señal" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
];

export interface GroupOption {
  id: string;
  name: string;
  accountId: string;
}

export interface DriverOption {
  id: string;
  firstName: string;
  lastName: string;
  accountId: string;
}

interface Props {
  selectedIds: string[];
  onClear: () => void;
  groupOptions: GroupOption[];
  driverOptions: DriverOption[];
  /** H7b · si false, el botón "Dar de baja" no se muestra */
  canDelete: boolean;
}

type ActiveAction = "group" | "driver" | "status" | "delete" | null;

export function BulkActionsToolbar({
  selectedIds,
  onClear,
  groupOptions,
  driverOptions,
  canDelete,
}: Props) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Popover state
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("MOVING");

  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Cerrar popovers con click fuera / Escape
  useEffect(() => {
    if (!activeAction) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setActiveAction(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveAction(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [activeAction]);

  // Auto-clear msg después de unos segundos
  useEffect(() => {
    if (!okMsg) return;
    const t = setTimeout(() => setOkMsg(null), 4000);
    return () => clearTimeout(t);
  }, [okMsg]);

  function handleApply(action: "group" | "driver" | "status" | "delete") {
    setErrorMsg(null);
    setOkMsg(null);

    startTransition(async () => {
      let result;
      if (action === "group") {
        const gid = selectedGroupId === "__none__" ? null : selectedGroupId || null;
        result = await bulkMoveToGroup(selectedIds, gid);
      } else if (action === "driver") {
        const did = selectedDriverId === "__none__" ? null : selectedDriverId || null;
        result = await bulkAssignDriver(selectedIds, did);
      } else if (action === "status") {
        result = await bulkChangeStatus(selectedIds, selectedStatus);
      } else {
        result = await bulkSoftDelete(selectedIds);
      }

      if (result.ok) {
        setOkMsg(result.message ?? "Acción aplicada");
        setActiveAction(null);
        onClear();
        router.refresh();
      } else {
        setErrorMsg(result.message ?? "Error al aplicar");
      }
    });
  }

  // Construir opciones de grupo con prefijo de cliente · ayuda a
  // distinguir "Norte de Transportes" vs "Norte de Rappi"
  const groupOptionsByLabel = groupOptions.map((g) => ({
    ...g,
    label: g.name,
  }));

  // Conductores con nombre completo
  const driverOptionsLabeled = driverOptions.map((d) => ({
    ...d,
    label: `${d.firstName} ${d.lastName}`,
  }));

  const count = selectedIds.length;

  return (
    <div ref={wrapRef} className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.count}>
          <strong>{count}</strong>{" "}
          {count === 1 ? "seleccionado" : "seleccionados"}
        </span>

        {/* Mover a grupo */}
        <ActionButton
          icon={<Folder size={14} />}
          label="Mover a grupo"
          active={activeAction === "group"}
          disabled={isPending}
          onClick={() =>
            setActiveAction(activeAction === "group" ? null : "group")
          }
        />

        {/* Asignar conductor */}
        <ActionButton
          icon={<UserCircle2 size={14} />}
          label="Asignar conductor"
          active={activeAction === "driver"}
          disabled={isPending}
          onClick={() =>
            setActiveAction(activeAction === "driver" ? null : "driver")
          }
        />

        {/* Cambiar estado */}
        <ActionButton
          icon={<Activity size={14} />}
          label="Cambiar estado"
          active={activeAction === "status"}
          disabled={isPending}
          onClick={() =>
            setActiveAction(activeAction === "status" ? null : "status")
          }
        />

        {/* Dar de baja · solo si tiene permiso de eliminar */}
        {canDelete && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() =>
              setActiveAction(activeAction === "delete" ? null : "delete")
            }
            disabled={isPending}
          >
            <Trash2 size={14} />
            <span>Dar de baja</span>
          </button>
        )}
      </div>

      <div className={styles.right}>
        {okMsg && <span className={styles.okMsg}>{okMsg}</span>}
        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClear}
          disabled={isPending}
        >
          <X size={13} />
          <span>Limpiar</span>
        </button>
      </div>

      {/* ── Popovers ──────────────────────────────────────── */}

      {activeAction === "group" && (
        <Popover>
          <PopoverHeader>Mover a grupo</PopoverHeader>
          <select
            className={styles.select}
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            disabled={isPending}
          >
            <option value="">— Elegí un grupo —</option>
            <option value="__none__">Sin grupo (quitar de su grupo)</option>
            {groupOptionsByLabel.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <PopoverFooter
            errorMsg={errorMsg}
            isPending={isPending}
            disabled={!selectedGroupId}
            onCancel={() => setActiveAction(null)}
            onApply={() => handleApply("group")}
            applyLabel="Mover"
          />
        </Popover>
      )}

      {activeAction === "driver" && (
        <Popover>
          <PopoverHeader>Asignar conductor</PopoverHeader>
          <select
            className={styles.select}
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            disabled={isPending}
          >
            <option value="">— Elegí un conductor —</option>
            <option value="__none__">Sin conductor (desasignar)</option>
            {driverOptionsLabeled.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <PopoverFooter
            errorMsg={errorMsg}
            isPending={isPending}
            disabled={!selectedDriverId}
            onCancel={() => setActiveAction(null)}
            onApply={() => handleApply("driver")}
            applyLabel="Asignar"
          />
        </Popover>
      )}

      {activeAction === "status" && (
        <Popover>
          <PopoverHeader>Cambiar estado</PopoverHeader>
          <select
            className={styles.select}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            disabled={isPending}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <PopoverFooter
            errorMsg={errorMsg}
            isPending={isPending}
            disabled={false}
            onCancel={() => setActiveAction(null)}
            onApply={() => handleApply("status")}
            applyLabel="Aplicar"
          />
        </Popover>
      )}

      {activeAction === "delete" && (
        <Popover variant="danger">
          <div className={styles.dangerHeader}>
            <AlertTriangle size={16} className={styles.dangerIcon} />
            <span>
              ¿Dar de baja a <strong>{count}</strong>{" "}
              {count === 1 ? "vehículo" : "vehículos"}?
            </span>
          </div>
          <p className={styles.dangerHint}>
            Los vehículos pasan a estado <strong>Mantenimiento</strong> y
            dejan de aparecer en las vistas operativas.
          </p>
          <PopoverFooter
            errorMsg={errorMsg}
            isPending={isPending}
            disabled={false}
            onCancel={() => setActiveAction(null)}
            onApply={() => handleApply("delete")}
            applyLabel="Dar de baja"
            applyDanger
          />
        </Popover>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function ActionButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.actionBtn} ${active ? styles.actionBtnActive : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span>{label}</span>
      <ChevronDown size={12} className={styles.chev} />
    </button>
  );
}

function Popover({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "danger";
}) {
  return (
    <div
      className={`${styles.popover} ${variant === "danger" ? styles.popoverDanger : ""}`}
      role="dialog"
    >
      {children}
    </div>
  );
}

function PopoverHeader({ children }: { children: React.ReactNode }) {
  return <div className={styles.popoverHeader}>{children}</div>;
}

function PopoverFooter({
  errorMsg,
  isPending,
  disabled,
  onCancel,
  onApply,
  applyLabel,
  applyDanger,
}: {
  errorMsg: string | null;
  isPending: boolean;
  disabled: boolean;
  onCancel: () => void;
  onApply: () => void;
  applyLabel: string;
  applyDanger?: boolean;
}) {
  return (
    <div className={styles.popoverFooter}>
      {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}
      <div className={styles.popoverActions}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={onCancel}
          disabled={isPending}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={
            applyDanger
              ? `${styles.applyBtn} ${styles.applyBtnDanger}`
              : styles.applyBtn
          }
          onClick={onApply}
          disabled={isPending || disabled}
        >
          {isPending ? "Aplicando…" : applyLabel}
        </button>
      </div>
    </div>
  );
}
