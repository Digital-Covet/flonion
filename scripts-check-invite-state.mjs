import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const q = async (label, sql) => {
  const { rows } = await client.query(sql);
  console.log(`\n=== ${label} ===`);
  console.table(rows);
};

await q("users", `
  SELECT u.email, u.role, u."onboardingCompleted" AS onboarded,
         u."businessId" AS member_of, ob.id AS owns,
         (u."businessId" IS NOT NULL AND NOT u."onboardingCompleted") AS trapped,
         (ob.id IS NOT NULL AND u."businessId" IS NOT NULL AND ob.id <> u."businessId") AS split_brain
  FROM "user" u
  LEFT JOIN business ob ON ob."userId" = u.id
  ORDER BY u."createdAt"`);

await q("businesses", `SELECT id, name, username, "userId" FROM business ORDER BY "createdAt"`);

await q("invitations", `
  SELECT i.email, i.status, i.role, b.name AS business, (now() > i."expiresAt") AS expired
  FROM invitation i JOIN business b ON b.id = i."businessId" ORDER BY i."createdAt" DESC`);

await client.end();
