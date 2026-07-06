import { prisma } from "../db/prisma.js";

// Durable (DB-backed) lockout so it survives a server restart, unlike an in-memory counter.
const LOCKOUT_WINDOW_MINUTES = 15;
const LOCKOUT_THRESHOLD = 5;

export async function recordLoginAttempt(ipAddress: string, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { ipAddress, success } });
}

export async function isLockedOut(ipAddress: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000);
  const recentFailures = await prisma.loginAttempt.count({
    where: { ipAddress, success: false, attemptedAt: { gte: since } },
  });
  return recentFailures >= LOCKOUT_THRESHOLD;
}
