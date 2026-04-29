"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type ActivityMetric,
  type AnalysisGranularity,
  type FleetAnalysisData,
  type ScopeFilters,
} from "@/lib/queries";
import { FleetScatter } from "@/components/maxtracker/analysis/FleetScatter";
import { MetricSelector } from "@/components/maxtracker/activity/MetricSelector";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import styles from "./CorrelacionesClient.module.css";

const BASE_PATH = "/direccion/correlaciones";

interface Props {
  data: FleetAnalysisData;
  dataY: FleetAnalysisData;
  metricY: ActivityMetric;
  invertY: boolean;
}

export function CorrelacionesClient({
  data,
  dataY,
  metricY,
  invertY,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function buildHref(over: {
    g?: AnalysisGranularity;
    m?: ActivityMetric;
    y?: ActivityMetric;
    iy?: boolean;
    d?: string | null;
    scope?: ScopeFilters;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? data.granularity;
    const m = over.m ?? data.metric;
    const y = over.y ?? metricY;
    const iy = over.iy ?? invertY;
    const d = over.d === null ? null : over.d ?? data.anchorIso;
    const scope = over.scope ?? data.appliedScope;

    if (g !== "month-days") params.set("g", g);
    if (m !== "distanceKm") params.set("m", m);
    if (y !== "speedingCount") params.set("y", y);
    if (iy) params.set("iy", "1");

    const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayIso = `${todayLocal.getUTCFullYear()}-${String(
      todayLocal.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
    if (d && d !== todayIso) params.set("d", d);
    if (scope.groupIds?.length) params.set("grp", scope.groupIds.join(","));
    if (scope.vehicleTypes?.length)
      params.set("type", scope.vehicleTypes.join(","));
    if (scope.personIds?.length)
      params.set("driver", scope.personIds.join(","));
    if (scope.search) params.set("q", scope.search);

    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function nav(over: Parameters<typeof buildHref>[0]) {
    startTransition(() => router.push(buildHref(over)));
  }

  function setScope(scope: ScopeFilters) {
    nav({ scope });
  }

  function setMetricY(y: ActivityMetric) {
    nav({ y });
  }

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(
    todayLocal.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const isAnchorToday = data.anchorIso === todayIso;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Correlaciones</h1>
          <p className={styles.sub}>
            Scatter · cada vehículo es un punto. Permite explorar
            correlaciones entre dos métricas a nivel de flota.
          </p>
        </div>
      </header>

      <div className={styles.toolbar}>
        <span className={styles.axisLabel}>Eje X</span>
        <MetricSelector value={data.metric} onChange={(m) => nav({ m })} />
        <span className={styles.axisLabel}>Eje Y</span>
        <MetricSelector value={metricY} onChange={setMetricY} />
        <button
          type="button"
          className={`${styles.invertBtn} ${invertY ? styles.invertBtnActive : ""}`}
          onClick={() => nav({ iy: !invertY })}
          title="Invertir eje Y"
        >
          ↕ {invertY ? "Y invertida" : "Invertir Y"}
        </button>
        <div className={styles.spacer} />
        <PeriodNavigator
          granularity={data.granularity}
          prevAnchor={data.prevAnchorIso}
          nextAnchor={data.nextAnchorIso}
          isToday={isAnchorToday}
          onChangeGranularity={(g) => nav({ g })}
          onChangeAnchor={(d) => nav({ d })}
        />
      </div>

      <ScopeFiltersBar
        scope={data.appliedScope}
        available={data.scope}
        rowCount={data.rows.length}
        onChange={setScope}
      />

      <div className={styles.body}>
        <FleetScatter
          dataX={data}
          dataY={dataY}
          invertY={invertY}
          formatValue={formatValue}
        />
      </div>
    </div>
  );
}

function formatValue(v: number, m: ActivityMetric): string {
  if (m === "distanceKm" || m === "fuelLiters") {
    return `${v.toLocaleString("es-AR", { maximumFractionDigits: v >= 100 ? 0 : 1 })} ${m === "distanceKm" ? "km" : "L"}`;
  }
  if (m === "maxSpeedKmh")
    return `${Math.round(v).toLocaleString("es-AR")} km/h`;
  if (m === "activeMin" || m === "idleMin") {
    if (v <= 0) return "0h";
    const h = Math.floor(v / 60);
    const mn = Math.round(v % 60);
    if (h === 0) return `${mn}m`;
    return mn === 0 ? `${h}h` : `${h}h${String(mn).padStart(2, "0")}`;
  }
  return Math.round(v).toLocaleString("es-AR");
}
