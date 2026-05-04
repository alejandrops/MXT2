// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { FeedbackRow } from "./FeedbackRow";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/feedback · S2-L6
//  ─────────────────────────────────────────────────────────────
//  Tabla de feedbacks recibidos vía el FeedbackWidget (S1-L8) +
//  controles para cambiar status y agregar notas internas.
//
//  Acceso · solo SUPER_ADMIN y MAXTRACKER_ADMIN. Otros perfiles
//  redirigen a /admin sin error visible.
//
//  Filtros (searchParams):
//    · status: NEW | REVIEWED | CLOSED | all (default: NEW)
//    · category: BUG | FEATURE | OTHER (opcional)
//    · page: paginación · 30 por página
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const STATUS_LABEL: Record<string, string> = {
  NEW: "Nuevos",
  REVIEWED: "Revisados",
  CLOSED: "Cerrados",
  all: "Todos",
};

const CATEGORY_LABEL: Record<string, string> = {
  BUG: "🐛 Bugs",
  FEATURE: "💡 Ideas",
  OTHER: "💬 Otros",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function FeedbackAdminPage({ searchParams }: PageProps) {
  // ── Access control ──────────────────────────────────────
  const session = await getSession();
  const sysKey = session.profile.systemKey;
  if (sysKey !== "SUPER_ADMIN" && sysKey !== "MAXTRACKER_ADMIN") {
    redirect("/admin");
  }

  const sp = await searchParams;
  const filterStatus =
    sp.status === "REVIEWED" ||
    sp.status === "CLOSED" ||
    sp.status === "NEW" ||
    sp.status === "all"
      ? sp.status
      : "NEW";
  const filterCategory =
    sp.category === "BUG" ||
    sp.category === "FEATURE" ||
    sp.category === "OTHER"
      ? sp.category
      : null;
  const page = Math.max(1, Number(sp.page) || 1);

  // ── Build where ──────────────────────────────────────────
  const where: any = {};
  if (filterStatus !== "all") where.status = filterStatus;
  if (filterCategory) where.category = filterCategory;

  // ── Fetch · counters + page ─────────────────────────────
  const [total, byStatusRaw, feedbacks] = await Promise.all([
    db.feedback.count({ where }),
    db.feedback.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            profile: { select: { nameLabel: true } },
          },
        },
      },
    }),
  ]);

  // Pivote contadores
  const counts: Record<string, number> = {
    NEW: 0,
    REVIEWED: 0,
    CLOSED: 0,
    all: 0,
  };
  for (const row of byStatusRaw) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Helper para construir URLs preservando filtros
  function buildUrl(params: Record<string, string | number | null>): string {
    const merged: Record<string, string | number | null> = {
      status: filterStatus,
      category: filterCategory,
      page,
      ...params,
    };
    const qs = Object.entries(merged)
      .filter(([, v]) => v !== null && v !== "" && v !== undefined)
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&");
    return `/admin/feedback${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Feedback</h1>
          <p className={styles.subtitle}>
            Mensajes enviados por usuarios desde el widget. Revisá y resolvé.
          </p>
        </div>
        <div className={styles.headStats}>
          <span className={styles.statBadge}>
            <strong>{counts.NEW}</strong> nuevos
          </span>
          <span className={styles.statBadge}>
            <strong>{counts.REVIEWED}</strong> en revisión
          </span>
          <span className={styles.statBadge}>
            <strong>{counts.CLOSED}</strong> cerrados
          </span>
        </div>
      </header>

      {/* ── Filtros ─────────────────────────────────────── */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Estado</span>
          <div className={styles.filterRow}>
            {(["NEW", "REVIEWED", "CLOSED", "all"] as const).map((s) => (
              <Link
                key={s}
                href={buildUrl({ status: s, page: 1 })}
                className={`${styles.filterChip} ${filterStatus === s ? styles.filterActive : ""}`}
              >
                {STATUS_LABEL[s]}
                {s !== "all" && (
                  <span className={styles.chipCount}>{counts[s]}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Categoría</span>
          <div className={styles.filterRow}>
            <Link
              href={buildUrl({ category: null, page: 1 })}
              className={`${styles.filterChip} ${filterCategory === null ? styles.filterActive : ""}`}
            >
              Todas
            </Link>
            {(["BUG", "FEATURE", "OTHER"] as const).map((c) => (
              <Link
                key={c}
                href={buildUrl({ category: c, page: 1 })}
                className={`${styles.filterChip} ${filterCategory === c ? styles.filterActive : ""}`}
              >
                {CATEGORY_LABEL[c]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lista ───────────────────────────────────────── */}
      {feedbacks.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {filterStatus === "NEW"
              ? "No hay feedbacks nuevos. 🎉"
              : "No hay feedbacks que coincidan con los filtros."}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {feedbacks.map((f) => (
              <FeedbackRow
                key={f.id}
                feedback={{
                  id: f.id,
                  category: f.category,
                  message: f.message,
                  pageUrl: f.pageUrl,
                  userAgent: f.userAgent,
                  viewport: f.viewport,
                  status: f.status,
                  createdAt: f.createdAt.toISOString(),
                  reviewedAt: f.reviewedAt?.toISOString() ?? null,
                  adminNotes: f.adminNotes,
                  user: f.user
                    ? {
                        name: `${f.user.firstName} ${f.user.lastName}`.trim(),
                        email: f.user.email,
                        profileLabel: f.user.profile.nameLabel,
                      }
                    : null,
                }}
              />
            ))}
          </div>

          {/* ── Paginación ────────────────────────────── */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              {page > 1 && (
                <Link
                  href={buildUrl({ page: page - 1 })}
                  className={styles.pageBtn}
                >
                  ← Anterior
                </Link>
              )}
              <span className={styles.pageInfo}>
                Página {page} de {totalPages} · {total} total
              </span>
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: page + 1 })}
                  className={styles.pageBtn}
                >
                  Siguiente →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
