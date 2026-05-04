"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type ActivityMetric,
  type AnalysisGranularity,
  type FleetAnalysisData,
  type ScopeFilters,
} from "@/lib/queries";
import { FleetBoxPlot } from "@/components/maxtracker/analysis/FleetBoxPlot";
import { MetricSelector } from "@/components/maxtracker/activity/MetricSelector";
import { PeriodNavigator } from "@/components/maxtracker/period/PeriodNavigator";
import { ScopeFilters as ScopeFiltersBar } from "@/components/maxtracker/analysis/ScopeFilters";
import styles from "./ComparativaObjetosClient.module.css";
import { PageHeader } from "@/components/maxtracker/ui";

const BASE_PATH = "/direccion/comparativa-objetos";

interface Props {
  data: FleetAnalysisData;
}

export function ComparativaObjetosClient({ data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function buildHref(over: {
    g?: AnalysisGranularity;
    m?: ActivityMetric;
    d?: string | null;
    scope?: ScopeFilters;
  }): string {
    const params = new URLSearchParams();
    const g = over.g ?? data.granularity;
    const m = over.m ?? data.metric;
    const d = over.d === null ? null : over.d ?? data.anchorIso;
    const scope = over.scope ?? data.appliedScope;

    if (g !== "month-days") params.set("g", g);
    if (m !== "distanceKm") params.set("m", m);

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

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = `${todayLocal.getUTCFullYear()}-${String(
    todayLocal.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayLocal.getUTCDate()).padStart(2, "0")}`;
  const isAnchorToday = data.anchorIso === todayIso;

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

  return (
    <>
      <PageHeader
        variant="module"
        title="Distribución por grupo"
        subtitle="Box plot · cada grupo de vehículos como caja con su Q1, mediana, Q3 y outliers. Útil para detectar heterogeneidad operativa intragrupal."
      />
      <div className="appPage">

      <div className={styles.toolbar}>
        <MetricSelector
          value={data.metric}
          onChange={(m) => nav({ m })}
        />
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
        <FleetBoxPlot data={data} formatValue={formatValue} />
      </div>
      </div>
    </>
  );
}
