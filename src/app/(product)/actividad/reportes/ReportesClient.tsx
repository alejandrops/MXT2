"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Grid3X3,
  Truck,
  Users,
  BarChart3,
  LineChart,
  Table2,
  TrendingUp,
} from "lucide-react";
import type {
  ActivityMetric,
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
import styles from "./ReportesClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  ReportesClient · 3 ejes (modo × ...)
//  ─────────────────────────────────────────────────────────────
//  Lote unificación · ahora maneja 2 modos top-level:
//
//  MODO TABLA · 4 vistas (sujeto × layout) · era la pantalla
//    Reportes original
//      vehicles × time     · DistributionView
//      vehicles × metrics  · MultiMetricView
//      drivers × time      · DriversDistributionView
//      drivers × metrics   · DriversMultiMetricView
//
//  MODO VISUAL · 3 vistas exploratorias · era pantalla Análisis
//      heatmap   · matriz vehículos × tiempo
//      ranking   · barras ordenadas
//      multiples · mini-líneas por vehículo
//      (todos comparten FleetAnalysisData · 1 loader)
//
//  URL params:
//    modo · visual | tabla (default)
//    si modo=visual:  vista · heatmap | ranking | multiples
//    si modo=tabla:   subject + layout (igual que antes)
// ═══════════════════════════════════════════════════════════════

export type Modo = "visual" | "tabla";
export type VistaVisual = "heatmap" | "ranking" | "multiples";
export type Subject = "vehicles" | "drivers";
export type Layout = "time" | "metrics";

const BASE_PATH = "/actividad/reportes";

// ── Variant types ──────────────────────────────────────────────

interface PropsVisual {
  modo: "visual";
  vista: VistaVisual;
  visualData: FleetAnalysisData;
}
interface PropsTablaVT {
  modo: "tabla";
  subject: "vehicles";
  layout: "time";
  data: FleetAnalysisData;
}
interface PropsTablaVM {
  modo: "tabla";
  subject: "vehicles";
  layout: "metrics";
  multiData: FleetMultiMetricData;
}
interface PropsTablaDT {
  modo: "tabla";
  subject: "drivers";
  layout: "time";
  driversData: DriversAnalysisData;
}
interface PropsTablaDM {
  modo: "tabla";
  subject: "drivers";
  layout: "metrics";
  driversMultiData: DriversMultiMetricData;
}

type Props =
  | PropsVisual
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

const LAYOUTS: { key: Layout; label: string; Icon: any; hint: string }[] = [
  { key: "time", label: "Por tiempo", Icon: Calendar, hint: "pivot vehículos × tiempo" },
  { key: "metrics", label: "Multi-métrica", Icon: Grid3X3, hint: "todas las métricas en una fila" },
];

export function ReportesClient(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navTo(href: string) {
    startTransition(() => router.push(href));
  }

  // ── Top-level switch · Modo Visual / Tabla ─────────────────
  function switchModo(targetModo: Modo) {
    if (targetModo === props.modo) return;
    if (targetModo === "visual") {
      navTo(`${BASE_PATH}?modo=visual&vista=heatmap`);
    } else {
      // back to tabla default
      navTo(`${BASE_PATH}`);
    }
  }

  function switchVistaVisual(vista: VistaVisual) {
    navTo(`${BASE_PATH}?modo=visual&vista=${vista}`);
  }

  function switchSubject(subject: Subject) {
    if (props.modo !== "tabla") return;
    const layout = props.layout;
    const params = new URLSearchParams();
    if (subject !== "vehicles") params.set("subject", subject);
    if (layout !== "time") params.set("layout", layout);
    const qs = params.toString();
    navTo(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  }

  function switchLayout(layout: Layout) {
    if (props.modo !== "tabla") return;
    const subject = props.subject;
    const params = new URLSearchParams();
    if (subject !== "vehicles") params.set("subject", subject);
    if (layout !== "time") params.set("layout", layout);
    const qs = params.toString();
    navTo(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  }

  return (
    <>
      <div className={styles.modesWrap}>
        {/* ── Top-level · Modo Visual/Tabla ────────────── */}
        <div className={styles.axisGroup}>
          <span className={styles.axisLabel}>Modo</span>
          <div className={styles.toggle} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={props.modo === "visual"}
              className={`${styles.btn} ${props.modo === "visual" ? styles.btnActive : ""}`}
              onClick={() => switchModo("visual")}
              title="Gráficos exploratorios · ver patrones"
            >
              <TrendingUp size={13} />
              <span>Visual</span>
            </button>
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
          </div>
        </div>

        {/* ── Sub-toggles · cambian según modo ──────────── */}
        {props.modo === "visual" ? (
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
        ) : (
          <>
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

            <div className={styles.axisGroup}>
              <span className={styles.axisLabel}>Vista</span>
              <div className={styles.toggle} role="tablist">
                {LAYOUTS.map((l) => {
                  const active = l.key === props.layout;
                  return (
                    <button
                      key={l.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`${styles.btn} ${active ? styles.btnActive : ""}`}
                      onClick={() => switchLayout(l.key)}
                      title={l.hint}
                    >
                      <l.Icon size={13} />
                      <span className={styles.btnLabel}>{l.label}</span>
                      <span className={styles.btnHint}>· {l.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Render del contenido según modo+vista ────── */}
      {props.modo === "visual" && (
        <VisualView vista={props.vista} data={props.visualData} />
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
