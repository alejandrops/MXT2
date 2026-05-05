"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Grid3X3,
  Truck,
  Users,
  BarChart3,
  LineChart,
  Table2,
  TrendingUp,
} from "lucide-react";
import type {
  DriversAnalysisData,
  DriversMultiMetricData,
  FleetAnalysisData,
  FleetMultiMetricData,
} from "@/lib/queries";
import { DistributionView } from "./DistributionView";
import { DriversDistributionView } from "./DriversDistributionView";
import { MultiMetricView } from "./MultiMetricView";
import { DriversMultiMetricView } from "./DriversMultiMetricView";
import { VisualView } from "./VisualView";
import { BulletMetricView } from "./BulletMetricView";
import styles from "./ReportesClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  ReportesClient · L3.5b · refactor de IA
//  ─────────────────────────────────────────────────────────────
//  Cambios vs versión previa:
//
//   1. Sacado el selector de Layout (Por tiempo / Multi-métrica).
//      Ahora el layout viene SIEMPRE forzado por la URL · sidebar
//      es la verdad. /actividad/evolucion → time, /resumen → metrics.
//
//   2. Reordenado · Sujeto es top, Modo (Visual/Tabla) es sub.
//      Antes: Modo top, después Sujeto. La nueva jerarquía refleja
//      mejor el modelo mental · primero decidís QUÉ analizás
//      (estructural), después CÓMO lo ves (representacional).
//
//   3. Visual + drivers no soportado · cuando subject=drivers, el
//      botón Modo=Visual está disabled · forzado a Tabla. Razón:
//      VisualView hoy solo opera sobre FleetAnalysisData (vehicles).
//      Drivers visual sería L11 o futuro.
//
//   4. Visual en /resumen · solo "ranking" (sin selector de vista).
//      Reusa FleetAnalysisData · ranking de la métrica activa entre
//      vehículos. Caso uso: ver quién es top de cada métrica.
//
//  URL params:
//    modo · visual | tabla (default tabla)
//    subject · vehicles (default) | drivers
//    vista · solo cuando modo=visual y layout=time
//    el resto (g, m, d, grp, type, driver, q) sin cambios
// ═══════════════════════════════════════════════════════════════

export type Modo = "visual" | "tabla";
export type VistaVisual = "heatmap" | "ranking" | "multiples";
export type Subject = "vehicles" | "drivers";
export type Layout = "time" | "metrics";

// ── Variant types · 5 combinaciones válidas ─────────────────────

interface PropsVisualTime {
  // Visual + vehicles + time = /evolucion modo visual
  layout: "time";
  modo: "visual";
  subject: "vehicles";
  vista: VistaVisual;
  visualData: FleetAnalysisData;
  baseUrl: string;
}
interface PropsVisualMetrics {
  // Visual + vehicles + metrics = /resumen modo visual · BulletMetricView (S3-L4)
  layout: "metrics";
  modo: "visual";
  subject: "vehicles";
  /** Cuando es bullet table · vehículos × métricas */
  multiData?: FleetMultiMetricData;
  /** Legacy fallback · ranking de 1 métrica · queda por compat */
  visualData?: FleetAnalysisData;
  baseUrl: string;
}
interface PropsTablaVT {
  layout: "time";
  modo: "tabla";
  subject: "vehicles";
  data: FleetAnalysisData;
  baseUrl: string;
}
interface PropsTablaVM {
  layout: "metrics";
  modo: "tabla";
  subject: "vehicles";
  multiData: FleetMultiMetricData;
  baseUrl: string;
}
interface PropsTablaDT {
  layout: "time";
  modo: "tabla";
  subject: "drivers";
  driversData: DriversAnalysisData;
  baseUrl: string;
}
interface PropsTablaDM {
  layout: "metrics";
  modo: "tabla";
  subject: "drivers";
  driversMultiData: DriversMultiMetricData;
  baseUrl: string;
}

type Props =
  | PropsVisualTime
  | PropsVisualMetrics
  | PropsTablaVT
  | PropsTablaVM
  | PropsTablaDT
  | PropsTablaDM;

const VISUAL_VISTAS: { key: VistaVisual; label: string; Icon: any; hint: string }[] = [
  { key: "heatmap", label: "Heatmap", Icon: Grid3X3, hint: "Matriz vehículos × tiempo" },
  { key: "ranking", label: "Ranking", Icon: BarChart3, hint: "Barras ordenadas" },
  { key: "multiples", label: "Small multiples", Icon: LineChart, hint: "Mini-líneas por vehículo" },
];

const SUBJECTS: { key: Subject; label: string; Icon: any }[] = [
  { key: "vehicles", label: "Vehículos", Icon: Truck },
  { key: "drivers", label: "Conductores", Icon: Users },
];

export function ReportesClient(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navTo(href: string) {
    startTransition(() => router.push(href));
  }

  /** Construye la URL preservando query state actual + override */
  function buildHref(override: {
    modo?: Modo;
    subject?: Subject;
    vista?: VistaVisual;
  }): string {
    const params = new URLSearchParams();
    const subject = override.subject ?? props.subject;
    const modo = override.modo ?? props.modo;
    const vista = override.vista ?? ("vista" in props ? props.vista : undefined);

    if (subject !== "vehicles") params.set("subject", subject);
    if (modo !== "tabla") params.set("modo", modo);
    if (modo === "visual" && vista && vista !== "heatmap") {
      params.set("vista", vista);
    }
    const qs = params.toString();
    return qs ? `${props.baseUrl}?${qs}` : props.baseUrl;
  }

  // Visual no soportado para drivers · forzar tabla si user clickea Visual mientras está en drivers
  const visualDisabledForDrivers = props.subject === "drivers";

  function switchSubject(targetSubject: Subject) {
    if (targetSubject === props.subject) return;
    // Si paso a drivers y está en modo visual, forzar tabla
    const targetModo: Modo = targetSubject === "drivers" ? "tabla" : props.modo;
    navTo(buildHref({ subject: targetSubject, modo: targetModo }));
  }

  function switchModo(targetModo: Modo) {
    if (targetModo === props.modo) return;
    if (targetModo === "visual" && visualDisabledForDrivers) return;
    navTo(buildHref({ modo: targetModo, vista: "heatmap" }));
  }

  function switchVistaVisual(targetVista: VistaVisual) {
    if (props.modo !== "visual") return;
    navTo(buildHref({ vista: targetVista }));
  }

  return (
    <>
      <div className={styles.modesWrap}>
        {/* ── 1. Sujeto · top-level ──────────────────────── */}
        <div className={styles.axisGroup}>
          <span className={styles.axisLabel}>Sujeto</span>
          <div className={styles.toggle} role="tablist">
            {SUBJECTS.map((s) => {
              const active = s.key === props.subject;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`${styles.btn} ${active ? styles.btnActive : ""}`}
                  onClick={() => switchSubject(s.key)}
                >
                  <s.Icon size={13} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2. Modo · sub-selector después de Sujeto ───── */}
        <div className={styles.axisGroup}>
          <span className={styles.axisLabel}>Modo</span>
          <div className={styles.toggle} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={props.modo === "tabla"}
              className={`${styles.btn} ${props.modo === "tabla" ? styles.btnActive : ""}`}
              onClick={() => switchModo("tabla")}
              title="Tablas densas · extraer datos"
            >
              <Table2 size={13} />
              <span>Tabla</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={props.modo === "visual"}
              className={`${styles.btn} ${props.modo === "visual" ? styles.btnActive : ""}`}
              onClick={() => switchModo("visual")}
              disabled={visualDisabledForDrivers}
              title={
                visualDisabledForDrivers
                  ? "Modo Visual disponible solo para Vehículos"
                  : "Gráficos exploratorios · ver patrones"
              }
            >
              <TrendingUp size={13} />
              <span>Visual</span>
            </button>
          </div>
        </div>

        {/* ── 3. Vista · sub-sub solo cuando modo=visual y layout=time ─── */}
        {props.modo === "visual" && props.layout === "time" && (
          <div className={styles.axisGroup}>
            <span className={styles.axisLabel}>Vista</span>
            <div className={styles.toggle} role="tablist">
              {VISUAL_VISTAS.map((v) => {
                const active = v.key === props.vista;
                return (
                  <button
                    key={v.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`${styles.btn} ${active ? styles.btnActive : ""}`}
                    onClick={() => switchVistaVisual(v.key)}
                    title={v.hint}
                  >
                    <v.Icon size={13} />
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Render del contenido según modo + subject + layout ────── */}
      {props.modo === "visual" && props.layout === "time" && (
        <VisualView vista={props.vista} data={props.visualData} />
      )}
      {props.modo === "visual" && props.layout === "metrics" && (
        // S3-L4 · /resumen visual = bullet table (vehículos × métricas)
        // Si por alguna razón no hay multiData, fallback al ranking legacy
        props.multiData ? (
          <BulletMetricView data={props.multiData} />
        ) : props.visualData ? (
          <VisualView vista="ranking" data={props.visualData} />
        ) : null
      )}
      {props.modo === "tabla" &&
        props.subject === "vehicles" &&
        props.layout === "time" && <DistributionView data={props.data} />}
      {props.modo === "tabla" &&
        props.subject === "vehicles" &&
        props.layout === "metrics" && <MultiMetricView data={props.multiData} />}
      {props.modo === "tabla" &&
        props.subject === "drivers" &&
        props.layout === "time" && (
          <DriversDistributionView data={props.driversData} />
        )}
      {props.modo === "tabla" &&
        props.subject === "drivers" &&
        props.layout === "metrics" && (
          <DriversMultiMetricView data={props.driversMultiData} />
        )}
    </>
  );
}
