// ═══════════════════════════════════════════════════════════════
//  backfill-account-settings.ts (S1)
//  ─────────────────────────────────────────────────────────────
//  Crea una row de AccountSettings con defaults LATAM para cada
//  Account que aún no tenga settings. Idempotente · solo crea
//  para accounts sin settings.
//
//  Uso:
//    npx tsx prisma/backfill-account-settings.ts
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("backfill-account-settings · creando settings");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  const accounts = await db.account.findMany({
    include: { settings: true },
  });

  let created = 0;
  let skipped = 0;

  for (const account of accounts) {
    if (account.settings) {
      skipped++;
      continue;
    }

    await db.accountSettings.create({
      data: {
        accountId: account.id,
        // Los defaults vienen del schema · solo seteamos accountId
      },
    });

    console.log(`  ✓ ${account.name} (${account.slug})`);
    created++;
  }

  console.log("");
  console.log(`  Creados: ${created} · Saltados: ${skipped}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((err) => {
    console.error("");
    console.error(`❌ Error: ${err}`);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
