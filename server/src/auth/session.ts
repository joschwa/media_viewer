import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { prisma } from "../db/prisma.js";

const TOKEN_BYTES = 32;

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function getSessionUser(token: string) {
  const session = await prisma.session.findUnique({ where: { id: token }, include: { user: true } });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
}
