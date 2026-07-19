import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { isScanInProgress, scanIncoming } from "../ingest/scanIncoming.js";
import { deleteMediaFiles } from "../media/media.routes.js";

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]).default("user"),
});

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

const resetPasswordSchema = z.object({ newPassword: z.string().min(8) });

const transferMediaSchema = z.object({ toUserId: z.number().int().positive() });

export function registerAdminRoutes(app: FastifyInstance): void {
  app.get("/api/admin/users", { preHandler: app.requireAdmin }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, createdAt: true, loginCount: true, lastLoginAt: true },
      orderBy: { id: "asc" },
    });
    reply.send(users);
  });

  app.post(
    "/api/admin/scan",
    { preHandler: app.requireAdmin, config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async (_request, reply) => {
      if (isScanInProgress()) {
        reply.code(409).send({ error: "A scan is already in progress" });
        return;
      }
      const result = await scanIncoming();
      reply.send(result);
    },
  );

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
    reply.code(201).send({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      loginCount: user.loginCount,
      lastLoginAt: user.lastLoginAt,
    });
  });

  app.delete("/api/admin/users/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const currentUser = request.currentUser!;

    if (id === currentUser.id) {
      reply.code(400).send({ error: "You can't delete your own account" });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      reply.code(404).send({ error: "Not found" });
      return;
    }

    if (target.role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        reply.code(400).send({ error: "Can't delete the last admin account" });
        return;
      }
    }

    // Their media has to go first — files can't be unlinked by a DB cascade, and the owner
    // relation is deliberately non-cascading so a bug here fails loudly instead of losing media.
    const ownedMedia = await prisma.mediaItem.findMany({ where: { ownerId: id } });
    for (const media of ownedMedia) {
      await deleteMediaFiles(media);
    }
    await prisma.mediaItem.deleteMany({ where: { ownerId: id } });
    await prisma.user.delete({ where: { id } });

    reply.send({ id, deleted: true });
  });

  app.patch(
    "/api/admin/users/:id/password",
    { preHandler: app.requireAdmin, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const { newPassword } = resetPasswordSchema.parse(request.body);

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) {
        reply.code(404).send({ error: "Not found" });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id }, data: { passwordHash } });
      // Unlike the self-service change, there's no "current session" to exempt here.
      await prisma.session.deleteMany({ where: { userId: id } });

      reply.send({ ok: true });
    },
  );

  app.post("/api/admin/users/:id/transfer-media", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const { toUserId } = transferMediaSchema.parse(request.body);

    if (id === toUserId) {
      reply.code(400).send({ error: "Can't transfer to the same user" });
      return;
    }

    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: toUserId } }),
    ]);
    if (!fromUser || !toUser) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    const { count } = await prisma.mediaItem.updateMany({ where: { ownerId: id }, data: { ownerId: toUserId } });
    reply.send({ transferred: count });
  });
}
