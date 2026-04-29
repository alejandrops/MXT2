"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin } from "lucide-react";
import {
  PageHeader,
  type ObjectStatus,
} from "@/components/maxtracker/ui";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import {
  applicableModules,
  type ModuleKey,
  type ObjectType,
} from "@/lib/object-modules";
import type { AnalysisGranularity } from "@/lib/queries";
import { ModuleTabs } from "./ModuleTabs";
import styles from "./ObjectBook.module.css";

// ═══════════════════════════════════════════════════════════════
//  ObjectBook · shell del Libro del Objeto
//  ─────────────────────────────────────────────────────────────
//  Renderiza las 3 capas comunes a todos los Libros:
//    Capa 1 · Identidad · <PageHeader variant="object">
//    Capa 2 · Período · PeriodNavigator
//    Capa 3 · Tabs por módulo
//  Y deja un slot para Capa 4 (contenido específico del módulo)
//  que cada page-route llena con su componente correspondiente.
//
//  El componente NO sabe qué módulo activo se está mostrando ·
//  recibe el contenido como `children` y los datos del header
//  como props. Esto permite que cada module-route haga su propia
//  data fetching.
// ═══════════════════════════════════════════════════════════════

const TYPE_LABELS: Record<ObjectType, string> = {
  vehiculo: "Vehículo",
  conductor: "Conductor",
  grupo: "Grupo",
};

const TYPE_BACK: Record<ObjectType, { label: string; href: string }> = {
  vehiculo: { label: "Vehículos", href: "/gestion/vehiculos" },
  conductor: { label: "Conductores", href: "/gestion/conductores" },
  grupo: { label: "Grupos", href: "/gestion/grupos" },
};

interface Props {
  /** Tipo del objeto · vehiculo, conductor, grupo */
  type: ObjectType;
  /** ID del objeto · usado para construir links */
  id: string;
  /** Nombre principal · ej "AG017HZ" */
  name: string;
  /** Subtítulo opcional · ej "Iveco Daily 35S15" */
  subtitle?: string;
  /** Línea metadata · ej "Patente ABC-123 · Grupo Sur" */
  metadata?: string;
  /** Estado actual · solo para vehículos */
  status?: ObjectStatus | null;
  /** Módulo activo · controla qué tab está marcada */
  activeModule: ModuleKey;
  /** Período · granularidad y ancla */
  granularity: AnalysisGranularity;
  anchorIso: string;
  prevAnchorIso: string;
  nextAnchorIso: string;
  isAnchorToday: boolean;
  /**
   * Slot opcional · contenido fijo entre el header y el periodBar.
   * Pensado para tiras de información persistente del objeto que
   * no cambian con el período ni con el tab · ej · LiveStatus para
   * vehículos. Si no se pasa, no se renderiza el espacio.
   */
  headerSlot?: React.ReactNode;
  /** Contenido del módulo activo · capa 4 */
  children: React.ReactNode;
}

export function ObjectBook({
  type,
  id,
  name,
  subtitle,
  metadata,
  status,
  activeModule,
  granularity,
  anchorIso,
  prevAnchorIso,
  nextAnchorIso,
  isAnchorToday,
  headerSlot,
  children,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const modules = applicableModules(type);

  function buildHref(over: {
    module?: ModuleKey;
    g?: AnalysisGranularity;
    d?: string | null;
  }): string {
    const params = new URLSearchParams();
    const m = over.module ?? activeModule;
    const g = over.g ?? granularity;
    const d = over.d === null ? null : over.d ?? anchorIso;

    if (m !== "actividad") params.set("m", m);
    if (g !== "month-days") params.set("g", g);

    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(
      todayLocal.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
    if (d && d !== todayIso) params.set("d", d);

    const qs = params.toString();
    const base = `/objeto/${type}/${id}`;
    return qs ? `${base}?${qs}` : base;
  }

  function navPeriod(over: {
    g?: AnalysisGranularity;
    d?: string | null;
  }) {
    startTransition(() => router.push(buildHref(over)));
  }

  const back = TYPE_BACK[type];

  // Acciones contextuales del header.
  // Por ahora solo "Ver en mapa" para vehículos · el ABM tradicional
  // ya no vive como pantalla separada · si en el futuro hace falta
  // edición de metadata, vivirá como tab "Configuración" del Libro.
  const actions =
    type === "vehiculo" ? (
      <div className={styles.actions}>
        <Link
          href={`/seguimiento/mapa?asset=${id}`}
          className={styles.actionLink}
          title="Ver este vehículo en el mapa"
        >
          <MapPin size={13} />
          <span>Ver en mapa</span>
        </Link>
      </div>
    ) : null;

  return (
    <div className={styles.book}>
      {/* ── Capa 1 · Identidad ─────────────────────────────── */}
      <PageHeader
        variant="object"
        objectType={TYPE_LABELS[type]}
        objectName={name}
        objectSubtitle={subtitle}
        metadata={metadata}
        status={status ?? null}
        backLabel={back.label}
        backHref={back.href}
        actions={actions}
      />

      {/* ── Capa 1.5 · Slot de información persistente ─────── */}
      {headerSlot}

      {/* ── Capa 2 · Período ───────────────────────────────── */}
      <div className={styles.periodBar}>
        <PeriodNavigator
          granularity={granularity}
          prevAnchor={prevAnchorIso}
          nextAnchor={nextAnchorIso}
          isToday={isAnchorToday}
          onChangeGranularity={(g) => navPeriod({ g })}
          onChangeAnchor={(d) => navPeriod({ d })}
        />
      </div>

      {/* ── Capa 3 · Tabs ──────────────────────────────────── */}
      <ModuleTabs
        modules={modules}
        active={activeModule}
        buildHref={(module) => buildHref({ module })}
      />

      {/* ── Capa 4 · Contenido del módulo ──────────────────── */}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
