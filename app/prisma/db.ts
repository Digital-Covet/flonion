import "temporal-polyfill/global";
import { PrismaClient } from "../generated/contract/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
export const db = new PrismaClient({ adapter });
