import "dotenv/config";
import { PrismaClient } from "@generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;

/**
 * One client per process. Server functions import this from inside `"use
 * server"` bodies, so without the global every Vite HMR pass in dev would
 * build a fresh `PrismaPg` pool and exhaust the database's connections.
 */
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;

export { prisma };
