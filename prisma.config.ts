// Patched by Maxtracker installer · cargar .env (Prisma 6 ya no lo hace solo)
try { process.loadEnvFile(".env"); } catch {}
// ═══════════════════════════════════════════════════════════════
//  Prisma config (TypeScript)
//  ─────────────────────────────────────────────────────────────
//  Replaces the deprecated `package.json#prisma` block. See
//  ADR-002 for rationale.
//
//  This file is auto-loaded by `prisma` CLI commands. Only the
//  fields we actually use are populated — Prisma 7 will warn
//  about unknown keys.
// ═══════════════════════════════════════════════════════════════

import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
