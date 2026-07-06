import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSessionUser } from "./session.js";

export const SESSION_COOKIE_NAME = "session";

type CurrentUser = { id: number; username: string; role: "admin" | "user" };

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function resolveCurrentUser(request: FastifyRequest): Promise<CurrentUser | null> {
  const raw = request.cookies[SESSION_COOKIE_NAME];
  if (!raw) return null;

  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;

  const user = await getSessionUser(unsigned.value);
  return user ? { id: user.id, username: user.username, role: user.role } : null;
}

export function registerAuthGuards(app: FastifyInstance): void {
  app.decorateRequest("currentUser", undefined);

  app.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await resolveCurrentUser(request);
    if (!user) {
      reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    request.currentUser = user;
  });

  app.decorate("requireAdmin", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await resolveCurrentUser(request);
    if (!user) {
      reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    if (user.role !== "admin") {
      reply.code(403).send({ error: "Forbidden" });
      return;
    }
    request.currentUser = user;
  });
}
