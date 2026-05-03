import {
  getAlarmDetail,
  getAlarmQueueKpis,
  listAlarmQueue,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { parseTorreUrl } from "@/lib/url-torre";
import { TorreClient } from "./TorreClient";
import { PageHeader } from "@/components/maxtracker/ui";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Torre de Control · alarm queue + detail (Opción C)
//
//  Multi-tenant scope (U1d): la cola y los KPIs se restringen al
//  account del user · y getAlarmDetail hace IDOR check evitando
//  que un CA pueda ver detalle de alarmas de otro cliente
//  conociendo el id.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TorreDeControlPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const urlState = parseTorreUrl(raw);

  // Multi-tenant scope (U1d)
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "seguridad", null);

  const [queue, kpis] = await Promise.all([
    listAlarmQueue({
      severity: urlState.severity,
      domain: urlState.domain,
      time: urlState.time,
      attendingOnly: urlState.attendingOnly,
      accountId: scopedAccountId,
    }),
    getAlarmQueueKpis(scopedAccountId),
  ]);

  let activeAlarmId = urlState.alarmId;
  if (activeAlarmId && !queue.some((q) => q.id === activeAlarmId)) {
    activeAlarmId = null;
  }
  if (!activeAlarmId && queue.length > 0) {
    activeAlarmId = queue[0]!.id;
  }
  // IDOR check vía scopedAccountId · getAlarmDetail devuelve null si la
  // alarma no es del account del user (ver ADR-005)
  const detail = activeAlarmId
    ? await getAlarmDetail(activeAlarmId, scopedAccountId)
    : null;

  return (
    <>
      <PageHeader variant="module" title="Torre de control" />
      <div className={`${styles.page} appPageFull`}>
        <TorreClient
          urlState={urlState}
          queue={queue}
          kpis={kpis}
          detail={detail}
          activeAlarmId={activeAlarmId}
        />
      </div>
    </>
  );
}
