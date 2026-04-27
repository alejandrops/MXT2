import {
  getAlarmDetail,
  getAlarmQueueKpis,
  listAlarmQueue,
} from "@/lib/queries";
import { parseTorreUrl } from "@/lib/url-torre";
import { TorreClient } from "./TorreClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Torre de Control · alarm queue + detail (Opción C)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TorreDeControlPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const urlState = parseTorreUrl(raw);

  const [queue, kpis] = await Promise.all([
    listAlarmQueue({
      severity: urlState.severity,
      domain: urlState.domain,
      time: urlState.time,
      attendingOnly: urlState.attendingOnly,
    }),
    getAlarmQueueKpis(),
  ]);

  let activeAlarmId = urlState.alarmId;
  if (activeAlarmId && !queue.some((q) => q.id === activeAlarmId)) {
    activeAlarmId = null;
  }
  if (!activeAlarmId && queue.length > 0) {
    activeAlarmId = queue[0]!.id;
  }
  const detail = activeAlarmId ? await getAlarmDetail(activeAlarmId) : null;

  return (
    <div className={styles.page}>
      <TorreClient
        urlState={urlState}
        queue={queue}
        kpis={kpis}
        detail={detail}
        activeAlarmId={activeAlarmId}
      />
    </div>
  );
}
