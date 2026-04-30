// ═══════════════════════════════════════════════════════════════
//  Ingestion metrics (I4)
//  ─────────────────────────────────────────────────────────────
//  Counter in-memory · acumula desde el inicio del proceso. Se
//  resetea cuando se reinicia el dev server.
//
//  Por qué in-memory:
//   · MVP de testing · no necesitamos persistir métricas operativas
//   · Cero overhead en el path de ingestion (writes a hash maps)
//   · Si en producción se quiere observabilidad seria, esto se
//     reemplaza con Prometheus/StatsD/OpenTelemetry sin tocar el
//     resto del código · ver `recordBatch` y `getSnapshot`.
//
//  Nota sobre concurrencia:
//   · Node.js es single-threaded para JS · los increments no tienen
//     race conditions desde el punto de vista del runtime.
//   · Si en algún momento el proceso pasa a worker threads o se
//     deploya en múltiples instancias, esto deja de ser correcto
//     · pasar a un store compartido (Redis INCR).
// ═══════════════════════════════════════════════════════════════

import type {
  IngestSummary,
  SkipReason,
} from "./flespi-types";

interface IngestionMetricsSnapshot {
  startedAt: string;
  uptimeSeconds: number;
  totals: {
    received: number;
    ok: number;
    skipped: number;
    duplicates: number;
    errors: number;
    tripsCreated: number;
    tripsDiscarded: number;
  };
  skipsByReason: Partial<Record<SkipReason, number>>;
  lastMessageAt: string | null;
  /** Contador de batches procesados (independiente del nro de messages). */
  batchesProcessed: number;
  /** Promedio de messages/batch. */
  avgBatchSize: number;
}

class IngestionMetrics {
  private startedAt = new Date();
  private totalReceived = 0;
  private totalOk = 0;
  private totalSkipped = 0;
  private totalDuplicates = 0;
  private totalErrors = 0;
  private totalTripsCreated = 0;
  private totalTripsDiscarded = 0;
  private skipsByReason: Partial<Record<SkipReason, number>> = {};
  private lastMessageAt: Date | null = null;
  private batchesProcessed = 0;

  /** Llamado al final de cada batch del endpoint /api/ingest/flespi. */
  recordBatch(
    summary: IngestSummary,
    duplicates: number,
    trips: { tripsCreated: number; tripsDiscarded: number },
  ): void {
    this.batchesProcessed++;
    this.totalReceived += summary.received;
    this.totalOk += summary.ok;
    this.totalSkipped += summary.skipped;
    this.totalErrors += summary.errors;
    this.totalDuplicates += duplicates;
    this.totalTripsCreated += trips.tripsCreated;
    this.totalTripsDiscarded += trips.tripsDiscarded;

    for (const [reason, count] of Object.entries(summary.skips_by_reason)) {
      const r = reason as SkipReason;
      this.skipsByReason[r] = (this.skipsByReason[r] ?? 0) + (count ?? 0);
    }

    if (summary.ok > 0 || summary.received > 0) {
      this.lastMessageAt = new Date();
    }
  }

  getSnapshot(): IngestionMetricsSnapshot {
    const uptimeSeconds = Math.floor(
      (Date.now() - this.startedAt.getTime()) / 1000,
    );
    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds,
      totals: {
        received: this.totalReceived,
        ok: this.totalOk,
        skipped: this.totalSkipped,
        duplicates: this.totalDuplicates,
        errors: this.totalErrors,
        tripsCreated: this.totalTripsCreated,
        tripsDiscarded: this.totalTripsDiscarded,
      },
      skipsByReason: { ...this.skipsByReason },
      lastMessageAt: this.lastMessageAt?.toISOString() ?? null,
      batchesProcessed: this.batchesProcessed,
      avgBatchSize:
        this.batchesProcessed > 0
          ? Math.round((this.totalReceived / this.batchesProcessed) * 10) / 10
          : 0,
    };
  }
}

// ─── Singleton del proceso ────────────────────────────────────
// En Next.js App Router (Node runtime), múltiples requests al mismo
// route handler comparten este módulo · el counter es compartido.
// En dev con hot reload puede recrearse · aceptable para diagnóstico.
declare global {
  // eslint-disable-next-line no-var
  var __maxtracker_ingest_metrics: IngestionMetrics | undefined;
}

export const ingestionMetrics: IngestionMetrics =
  globalThis.__maxtracker_ingest_metrics ??
  (globalThis.__maxtracker_ingest_metrics = new IngestionMetrics());
