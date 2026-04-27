import { Suspense } from "react";
import {
  buildPeriod,
  getActivityPivot,
  type ActivityMetric,
  type ActivityPreset,
} from "@/lib/queries";
import { ReportesClient } from "./ReportesClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Actividad · Reportes
//  ─────────────────────────────────────────────────────────────
//  Pivot table assets × días, con selector de métrica y export
//  CSV. Lectura de URL params:
//    · period: today | yesterday | 7d | 30d | custom
//    · from / to: YYYY-MM-DD si period=custom
//    · metric: distanceKm | activeMin | ... (9 opciones)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const VALID_METRICS: ActivityMetric[] = [
  "distanceKm",
  "activeMin",
  "idleMin",
  "tripCount",
  "eventCount",
  "highEventCount",
  "speedingCount",
  "maxSpeedKmh",
  "fuelLiters",
];

const VALID_PRESETS: ActivityPreset[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "custom",
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const get = (k: string): string | null => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "string" && v.length > 0 ? v : null;
  };

  const periodRaw = get("period");
  const preset: ActivityPreset =
    periodRaw && (VALID_PRESETS as string[]).includes(periodRaw)
      ? (periodRaw as ActivityPreset)
      : "7d";
  const metricRaw = get("metric");
  const metric: ActivityMetric =
    metricRaw && (VALID_METRICS as string[]).includes(metricRaw)
      ? (metricRaw as ActivityMetric)
      : "distanceKm";
  const from = get("from") ?? undefined;
  const to = get("to") ?? undefined;

  const period = buildPeriod(preset, from, to);
  const pivot = await getActivityPivot({ period, metric });

  return (
    <div className={styles.wrap}>
      <Suspense fallback={null}>
        <ReportesClient
          pivot={pivot}
          preset={preset}
          customFrom={from ?? null}
          customTo={to ?? null}
        />
      </Suspense>
    </div>
  );
}
