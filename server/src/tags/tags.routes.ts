import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const createTagSchema = z.object({ name: z.string().trim().min(1).max(50) });

export function registerTagRoutes(app: FastifyInstance): void {
  app.get("/api/tags", { preHandler: app.requireAuth }, async (_request, reply) => {
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    reply.send(tags);
  });

  app.post("/api/tags", { preHandler: app.requireAuth }, async (request, reply) => {
    const { name } = createTagSchema.parse(request.body);

    // Case-insensitive dedup: return the existing tag rather than erroring or creating a duplicate.
    const existing = await prisma.tag.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) {
      reply.send(existing);
      return;
    }

    const tag = await prisma.tag.create({ data: { name } });
    reply.code(201).send(tag);
  });
}
