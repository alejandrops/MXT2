// ═══════════════════════════════════════════════════════════════
//  Prisma Client — singleton pattern for Next.js
//  ─────────────────────────────────────────────────────────────
//  Next.js hot-reloads on file changes in dev, which would spin
//  up a new PrismaClient on every reload and eventually exhaust
//  database connections. We stash the client on the global object
//  so HMR reuses it.
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
