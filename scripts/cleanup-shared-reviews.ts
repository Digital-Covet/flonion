import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("[CLEANUP] Starting shared_review debloat...");

  const users = await prisma.user.findMany({
    select: { id: true },
  });

  let totalDeleted = 0;

  for (const user of users) {
    const reviews = await prisma.sharedReview.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (reviews.length <= 1) continue;

    const keepId = reviews[0].id;
    const deleteIds = reviews.slice(1).map((r) => r.id);

    const result = await prisma.sharedReview.deleteMany({
      where: { id: { in: deleteIds } },
    });

    totalDeleted += result.count;
    console.log(
      `[CLEANUP] User ${user.id}: kept ${keepId}, deleted ${result.count} record(s)`,
    );
  }

  console.log(`[CLEANUP] Done. Total deleted: ${totalDeleted}`);
}

main()
  .catch((e) => {
    console.error("[CLEANUP] Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
