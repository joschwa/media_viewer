import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db/prisma.js";
import { resolveCurrentUser, SESSION_COOKIE_NAME } from "./guards.js";
import { isLockedOut, recordLoginAttempt } from "./loginAttempts.js";
import { createSession, destroySession } from "./session.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Compared against when no such user exists, so a login attempt for an unknown username takes
// roughly the same time as one for a known username with a wrong password (no enumeration timing leak).
const DUMMY_HASH = bcrypt.hashSync("no-such-user-placeholder", 12);

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const ip = request.ip;

      if (await isLockedOut(ip)) {
        reply.code(429).send({ error: "Too many failed attempts. Try again later." });
        return;
      }

      const user = await prisma.user.findUnique({ where: { username: body.username } });
      const passwordMatches = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
      const loginOk = Boolean(user) && passwordMatches;

      await recordLoginAttempt(ip, loginOk);

      if (!user || !loginOk) {
        reply.code(401).send({ error: "Invalid username or password" });
        return;
      }

      const { token, expiresAt } = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE_NAME, token, {
        signed: true,
        httpOnly: true,
        sameSite: "lax",
        secure: config.httpsEnabled,
        path: "/",
        expires: expiresAt,
      });
      reply.send({ loggedIn: true, userId: user.id, username: user.username, role: user.role });
    },
  );

  app.post("/api/logout", async (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE_NAME];
    if (raw) {
      const unsigned = request.unsignCookie(raw);
      if (unsigned.valid && unsigned.value) {
        await destroySession(unsigned.value);
      }
    }
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    reply.send({ loggedOut: true });
  });

  app.get("/api/session", async (request, reply) => {
    const user = await resolveCurrentUser(request);
    if (!user) {
      reply.send({ loggedIn: false });
      return;
    }
    reply.send({ loggedIn: true, userId: user.id, username: user.username, role: user.role });
  });
}
