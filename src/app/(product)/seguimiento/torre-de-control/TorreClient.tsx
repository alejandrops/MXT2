"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  EyeOff,
  Filter,
  Phone,
  X,
} from "lucide-react";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  AlarmDetail,
  AlarmDomainFilter,
  AlarmQueueFilter,
  AlarmQueueKpis,
  AlarmQueueRow,
  AlarmTimeFilter,
} from "@/lib/queries/torre";
import { buildTorreUrl, type TorreUrlState } from "@/lib/url-torre";
import { attendAlarm, closeAlarm } from "./actions";
import { CloseAlarmModal } from "./CloseAlarmModal";
import styles from "./TorreClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  TorreClient · alarm queue UI
// ═══════════════════════════════════════════════════════════════

interface Props {
  urlState: TorreUrlState;
  queue: AlarmQueueRow[];
  kpis: AlarmQueueKpis;
  detail: AlarmDetail | null;
  activeAlarmId: string | null;
}

export function TorreClient({
  urlState,
  queue,
  kpis,
  detail,
  activeAlarmId,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function nav(override: Partial<TorreUrlState>) {
    const href = buildTorreUrl(urlState, override);
    startTransition(() => router.push(href));
  }

  async function onAttend() {
    if (!detail) return;
    setActionError(null);
    setPending(true);
    const r = await attendAlarm(detail.id);
    setPending(false);
    if (!r.ok) {
      setActionError(r.error ?? "No se pudo atender la alarma");
      return;
    }
    // refresh data without changing URL
    startTransition(() => router.refresh());
  }

  async function onConfirmClose(notes: string): Promise<string | null> {
    if (!detail) return "Sin alarma seleccionada";
    setActionError(null);
    const r = await closeAlarm(detail.id, notes);
    if (!r.ok) return r.error ?? "No se pudo cerrar la alarma";
    setCloseModalOpen(false);
    startTransition(() => {
      router.replace(buildTorreUrl(urlState, { alarmId: null }));
      router.refresh();
    });
    return null;
  }

  return (
    <>
      {/* ── Header KPI strip ───────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Torre de control</h1>
          <p className={styles.subtitle}>
            Cola priorizada de alarmas · atendé las críticas más viejas
            primero
          </p>
        </div>
        <div className={styles.kpiStrip}>
          <Kpi label="Abiertas" value={kpis.open} accent="red" />
          <Kpi label="En atención" value={kpis.attending} accent="ora" />
          <Kpi label="Cerradas hoy" value={kpis.closedToday} accent="grn" />
          <span className={styles.kpiDivider} />
          <Kpi label="Críticas" value={kpis.bySeverity.critical} small />
          <Kpi label="Altas" value={kpis.bySeverity.high} small />
          <Kpi label="Medias" value={kpis.bySeverity.medium} small />
          <Kpi label="Bajas" value={kpis.bySeverity.low} small />
        </div>
      </div>

      {/* ── Body · 2 columnas ────────────────────────────────── */}
      <div className={styles.body}>
        {/* Cola izquierda */}
        <div className={styles.queueCol}>
          <FilterBar urlState={urlState} onChange={nav} />
          <div className={styles.queueList}>
            {queue.length === 0 ? (
              <div className={styles.queueEmpty}>
                <Check size={28} className={styles.queueEmptyIcon} />
                <span className={styles.queueEmptyTitle}>
                  Sin alarmas pendientes
                </span>
                <span className={styles.queueEmptySub}>
                  Operación tranquila · todo en regla.
                </span>
              </div>
            ) : (
              queue.map((row) => (
                <QueueItem
                  key={row.id}
                  row={row}
                  active={row.id === activeAlarmId}
                  onClick={() => nav({ alarmId: row.id })}
                />
              ))
            )}
          </div>
        </div>

        {/* Detalle derecha */}
        <div className={styles.detailCol}>
          {detail ? (
            <DetailPanel
              detail={detail}
              pending={pending}
              actionError={actionError}
              onAttend={onAttend}
              onCloseRequest={() => setCloseModalOpen(true)}
            />
          ) : (
            <div className={styles.detailEmpty}>
              <Check size={42} className={styles.detailEmptyIcon} />
              <span className={styles.detailEmptyTitle}>
                Todo en orden
              </span>
              <span className={styles.detailEmptySub}>
                No hay alarmas pendientes para los filtros activos.
              </span>
            </div>
          )}
        </div>
      </div>

      <CloseAlarmModal
        open={closeModalOpen}
        alarm={detail}
        onCancel={() => setCloseModalOpen(false)}
        onConfirm={onConfirmClose}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  KPI block
// ═══════════════════════════════════════════════════════════════

function Kpi({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: number;
  accent?: "red" | "ora" | "grn";
  small?: boolean;
}) {
  return (
    <div className={`${styles.kpi} ${small ? styles.kpiSmall : ""}`}>
      <span className={styles.kpiLabel}>{label}</span>
      <span
        className={`${styles.kpiValue} ${
          accent === "red"
            ? styles.kpiRed
            : accent === "ora"
              ? styles.kpiOra
              : accent === "grn"
                ? styles.kpiGrn
                : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Filter bar (cola izquierda)
// ═══════════════════════════════════════════════════════════════

function FilterBar({
  urlState,
  onChange,
}: {
  urlState: TorreUrlState;
  onChange: (override: Partial<TorreUrlState>) => void;
}) {
  return (
    <div className={styles.filterBar}>
      <div className={styles.filterIcon}>
        <Filter size={12} />
      </div>
      <FilterPill<AlarmQueueFilter>
        label="Severidad"
        value={urlState.severity}
        options={[
          { value: "all", label: "Todas" },
          { value: "high+", label: "Altas+" },
          { value: "critical", label: "Críticas" },
        ]}
        onChange={(v) => onChange({ severity: v })}
      />
      <FilterPill<AlarmDomainFilter>
        label="Tipo"
        value={urlState.domain}
        options={[
          { value: "all", label: "Todos" },
          { value: "CONDUCCION", label: "Conducción" },
          { value: "SEGURIDAD", label: "Seguridad" },
        ]}
        onChange={(v) => onChange({ domain: v })}
      />
      <FilterPill<AlarmTimeFilter>
        label="Tiempo"
        value={urlState.time}
        options={[
          { value: "all", label: "Todo" },
          { value: "1h", label: "Última hora" },
          { value: "today", label: "Hoy" },
        ]}
        onChange={(v) => onChange({ time: v })}
      />
      <button
        type="button"
        className={`${styles.attBtn} ${
          urlState.attendingOnly ? styles.attBtnActive : ""
        }`}
        onClick={() => onChange({ attendingOnly: !urlState.attendingOnly })}
        title="Mostrar sólo en atención"
      >
        <EyeOff size={11} />
        <span>En atención</span>
      </button>
    </div>
  );
}

function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <div className={styles.pillWrap}>
      <button
        type="button"
        className={styles.pill}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.pillLabel}>{label}:</span>
        <span className={styles.pillValue}>{current}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className={styles.pillBackdrop} onClick={() => setOpen(false)} />
          <div className={styles.pillMenu} role="listbox">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`${styles.pillOption} ${
                  opt.value === value ? styles.pillOptionActive : ""
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Queue item
// ═══════════════════════════════════════════════════════════════

function QueueItem({
  row,
  active,
  onClick,
}: {
  row: AlarmQueueRow;
  active: boolean;
  onClick: () => void;
}) {
  const sev = row.severity;
  return (
    <button
      type="button"
      className={`${styles.qItem} ${active ? styles.qItemActive : ""} ${
        sev === "CRITICAL"
          ? styles.qItemCrit
          : sev === "HIGH"
            ? styles.qItemHigh
            : sev === "MEDIUM"
              ? styles.qItemMed
              : styles.qItemLow
      }`}
      onClick={onClick}
      aria-current={active}
    >
      <div className={styles.qItemHeader}>
        <span className={styles.qSevTag}>{sevShort(sev)}</span>
        <span className={styles.qItemAge}>{formatAge(row.ageSec)}</span>
        {row.attendedAt && (
          <span className={styles.qAttBadge}>en atención</span>
        )}
      </div>
      <div className={styles.qItemAsset}>{row.assetName}</div>
      <div className={styles.qItemMeta}>
        <span className={styles.qItemType}>{row.typeLabel}</span>
        {row.assetPlate && (
          <span className={styles.qItemPlate}>{row.assetPlate}</span>
        )}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Detail panel
// ═══════════════════════════════════════════════════════════════

function DetailPanel({
  detail,
  pending,
  actionError,
  onAttend,
  onCloseRequest,
}: {
  detail: AlarmDetail;
  pending: boolean;
  actionError: string | null;
  onAttend: () => void;
  onCloseRequest: () => void;
}) {
  const triggeredAgo = formatAge(
    Math.floor((Date.now() - detail.triggeredAt.getTime()) / 1000),
  );

  return (
    <div className={styles.detail}>
      {/* Header con vehículo + sevTag */}
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderTop}>
          <SevBigTag sev={detail.severity} />
          <Link
            href={`/gestion/vehiculos/${detail.assetId}`}
            className={styles.detailAssetLink}
          >
            <span className={styles.detailAssetName}>{detail.assetName}</span>
            {detail.assetPlate && (
              <span className={styles.detailPlate}>{detail.assetPlate}</span>
            )}
          </Link>
          {detail.attendedAt && (
            <span className={styles.detailAttBadge}>
              Atendida hace{" "}
              {formatAge(
                Math.floor(
                  (Date.now() - detail.attendedAt.getTime()) / 1000,
                ),
              )}
            </span>
          )}
        </div>
        <div className={styles.detailHeaderBottom}>
          <span className={styles.detailType}>{detail.typeLabel}</span>
          <span className={styles.detailDot}>·</span>
          <span className={styles.detailMeta}>
            <Clock size={11} /> hace {triggeredAgo}
          </span>
          {detail.driverName && (
            <>
              <span className={styles.detailDot}>·</span>
              <span className={styles.detailMeta}>
                Conductor: {detail.driverName}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Body con stats + contexto */}
      <div className={styles.detailBody}>
        {/* Última posición + datos en vivo */}
        <Section title="Última posición conocida">
          {detail.lastLat !== null && detail.lastLng !== null ? (
            <div className={styles.posGrid}>
              <Stat
                label="Coordenadas"
                value={`${detail.lastLat.toFixed(4)}, ${detail.lastLng.toFixed(4)}`}
              />
              <Stat
                label="Velocidad"
                value={
                  detail.lastSpeedKmh !== null
                    ? `${Math.round(detail.lastSpeedKmh)} km/h`
                    : "—"
                }
              />
              <Stat
                label="Motor"
                value={
                  detail.lastIgnition === null
                    ? "—"
                    : detail.lastIgnition
                      ? "ON"
                      : "OFF"
                }
              />
              <Stat
                label="Visto hace"
                value={
                  detail.msSinceLastSeen === null
                    ? "—"
                    : formatAge(Math.floor(detail.msSinceLastSeen / 1000))
                }
              />
            </div>
          ) : (
            <div className={styles.posEmpty}>
              Sin posición registrada para este vehículo.
            </div>
          )}
        </Section>

        {/* Contexto temporal · eventos previos */}
        <Section title="Contexto · eventos en las 2 horas previas">
          {detail.precedingEvents.length === 0 ? (
            <div className={styles.eventsEmpty}>
              Sin eventos antes de la alarma.
            </div>
          ) : (
            <ul className={styles.eventsList}>
              {detail.precedingEvents.map((e) => (
                <li key={e.id} className={styles.eventRow}>
                  <span
                    className={`${styles.eventSev} ${
                      e.severity === "CRITICAL"
                        ? styles.eventSevCrit
                        : e.severity === "HIGH"
                          ? styles.eventSevHigh
                          : ""
                    }`}
                  />
                  <span className={styles.eventLabel}>{e.typeLabel}</span>
                  <span className={styles.eventBefore}>
                    {formatBefore(e.secBeforeAlarm)} antes
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Notas (si está cerrada) */}
        {detail.notes && (
          <Section title="Nota del operador">
            <p className={styles.notes}>{detail.notes}</p>
          </Section>
        )}
      </div>

      {/* Footer · acciones */}
      <footer className={styles.detailFooter}>
        {actionError && (
          <div className={styles.actionError}>
            <AlertTriangle size={12} />
            <span>{actionError}</span>
          </div>
        )}
        <div className={styles.actions}>
          {detail.driverPhone && (
            <a
              href={`tel:${detail.driverPhone.replace(/-/g, "")}`}
              className={styles.btnSecondary}
              title={`Llamar a ${detail.driverName}`}
            >
              <Phone size={13} />
              <span>Llamar</span>
              <span className={styles.btnHint}>{detail.driverPhone}</span>
            </a>
          )}
          {!detail.attendedAt ? (
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={pending}
              onClick={onAttend}
            >
              <EyeOff size={13} />
              <span>Atender</span>
            </button>
          ) : (
            <span className={styles.attendedNote}>Ya atendida</span>
          )}
          <button
            type="button"
            className={styles.btnDanger}
            disabled={pending}
            onClick={onCloseRequest}
          >
            <X size={13} />
            <span>Cerrar alarma</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

function SevBigTag({ sev }: { sev: string }) {
  return (
    <span
      className={`${styles.sevBig} ${
        sev === "CRITICAL"
          ? styles.sevBigCrit
          : sev === "HIGH"
            ? styles.sevBigHigh
            : sev === "MEDIUM"
              ? styles.sevBigMed
              : styles.sevBigLow
      }`}
    >
      {sevLabel(sev)}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function sevShort(s: string): string {
  if (s === "CRITICAL") return "CRIT";
  if (s === "HIGH") return "ALTA";
  if (s === "MEDIUM") return "MED";
  return "BAJA";
}

function sevLabel(s: string): string {
  if (s === "CRITICAL") return "Crítica";
  if (s === "HIGH") return "Alta";
  if (s === "MEDIUM") return "Media";
  return "Baja";
}

function formatAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  if (h < 24) return mr === 0 ? `${h}h` : `${h}h ${mr}m`;
  return `${Math.floor(h / 24)}d`;
}

function formatBefore(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  return mr === 0 ? `${h}h` : `${h}h ${mr}m`;
}
