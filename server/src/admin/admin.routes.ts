import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]).default("user"),
});

export function registerAdminRoutes(app: FastifyInstance): void {
  app.get("/api/admin/users", { preHandler: app.requireAdmin }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, createdAt: true },
      orderBy: { id: "asc" },
    });
    reply.send(users);
  });

  app.post("/api/admin/users", { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { username: body.username } });
    if (existing) {
      reply.code(409).send({ error: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { username: body.username, passwordHash, role: body.role },
    });
    reply.code(201).send({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt });
  });
}
