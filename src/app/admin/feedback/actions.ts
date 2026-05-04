"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  /admin/feedback · server actions · S2-L6
//  ─────────────────────────────────────────────────────────────
//  Mutations sobre Feedback · solo perfiles SUPER_ADMIN o
//  MAXTRACKER_ADMIN pueden modificar.
//
//  Acciones:
//    · markStatus  · NEW → REVIEWED → CLOSED (o reopen)
//    · saveNotes   · update adminNotes (texto libre)
// ═══════════════════════════════════════════════════════════════

type Status = "NEW" | "REVIEWED" | "CLOSED";

async function assertAdmin() {
  const session = await getSession();
  const sysKey = session.profile.systemKey;
  if (sysKey !== "SUPER_ADMIN" && sysKey !== "MAXTRACKER_ADMIN") {
    throw new Error("No autorizado · solo Super Admin / Maxtracker Admin");
  }
  return session;
}

export async function markStatus(
  feedbackId: string,
  status: Status,
): Promise<void> {
  await assertAdmin();
  await db.feedback.update({
    where: { id: feedbackId },
    data: {
      status,
      reviewedAt:
        status === "REVIEWED" || status === "CLOSED" ? new Date() : null,
    },
  });
  revalidatePath("/admin/feedback");
}

export async function saveNotes(
  feedbackId: string,
  notes: string,
): Promise<void> {
  await assertAdmin();
  await db.feedback.update({
    where: { id: feedbackId },
    data: {
      adminNotes: notes.trim().length > 0 ? notes.trim() : null,
    },
  });
  revalidatePath("/admin/feedback");
}
