import "dotenv/config";
import { PrismaClient } from "@generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import normalizeEmail from "validator/lib/normalizeEmail.js";

/**
 * Fills user.normalizedEmail for accounts created before better-auth-harmony
 * was added. New and updated users get it from the plugin's database hook;
 * this uses the same normalizer (see emailHarmony in src/lib/auth.ts).
 *
 * Accounts whose addresses normalize to the same value (john@gmail.com and
 * j.ohn+x@gmail.com) cannot all hold it under the unique index. The oldest
 * one gets it; the rest stay NULL and are listed for manual review.
 */
const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("[BACKFILL] Starting normalizedEmail backfill...");

  const users = await prisma.user.findMany({
    where: { normalizedEmail: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });

  let updated = 0;
  const skipped: string[] = [];

  for (const user of users) {
    const normalizedEmail = normalizeEmail(user.email);
    if (!normalizedEmail) {
      skipped.push(`${user.id} (${user.email}): could not normalize`);
      continue;
    }

    const holder = await prisma.user.findUnique({
      where: { normalizedEmail },
      select: { id: true },
    });
    if (holder) {
      skipped.push(`${user.id} (${user.email}): same inbox as ${holder.id}`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { normalizedEmail },
    });
    updated += 1;
  }

  console.log(
    `[BACKFILL] Done. Updated ${updated} of ${users.length} user(s).`,
  );
  if (skipped.length > 0) {
    console.log(`[BACKFILL] Left ${skipped.length} user(s) NULL:`);
    for (const line of skipped) console.log(`  ${line}`);
  }
}

main()
  .catch((error) => {
    console.error("[BACKFILL] Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
