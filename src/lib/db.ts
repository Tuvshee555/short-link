import { PrismaClient } from "@prisma/client";

// One client per server instance. In dev, hot reloads would otherwise open a
// new connection pool on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
