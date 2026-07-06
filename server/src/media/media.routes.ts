import type { MediaItem } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const listQuerySchema = z.object({
  orderBy: z.enum(["captured_at", "filename", "none"]).default("captured_at"),
  mine: z.enum(["true", "false"]).optional(),
});

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

function toListItem(media: MediaItem) {
  return {
    id: media.id,
    mediaType: media.mediaType,
    originalFilename: media.originalFilename,
    width: media.width,
    height: media.height,
    durationSeconds: media.durationSeconds ? media.durationSeconds.toNumber() : null,
    capturedAt: media.capturedAt?.toISOString() ?? null,
    importedAt: media.importedAt.toISOString(),
    ownerId: media.ownerId,
    visibility: media.visibility,
  };
}

/** Loads a media item and enforces the owner-or-public visibility rule; replies 404/403 itself on failure. */
async function loadAuthorizedMedia(request: FastifyRequest, reply: FastifyReply): Promise<MediaItem | null> {
  const { id } = idParamSchema.parse(request.params);

  const media = await prisma.mediaItem.findUnique({ where: { id } });
  if (!media || media.deletedAt) {
    reply.code(404).send({ error: "Not found" });
    return null;
  }

  const user = request.currentUser!;
  if (media.ownerId !== user.id && media.visibility !== "public") {
    reply.code(403).send({ error: "Forbidden" });
    return null;
  }

  return media;
}

export function registerMediaRoutes(app: FastifyInstance): void {
  app.get("/api/media", { preHandler: app.requireAuth }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const user = request.currentUser!;

    const visibilityFilter =
      query.mine === "true"
        ? { ownerId: user.id }
        : { OR: [{ ownerId: user.id }, { visibility: "public" as const }] };

    const orderBy =
      query.orderBy === "filename"
        ? { originalFilename: "asc" as const }
        : query.orderBy === "none"
          ? undefined
          : { capturedAt: "asc" as const };

    const items = await prisma.mediaItem.findMany({
      where: { deletedAt: null, ...visibilityFilter },
      orderBy,
    });

    reply.send(items.map(toListItem));
  });

  app.get("/api/media/:id/original", { preHandler: app.requireAuth }, async (request, reply) => {
    const media = await loadAuthorizedMedia(request, reply);
    if (!media) return;
    return reply.sendFile(media.storagePath);
  });

  app.get("/api/media/:id/thumbnail", { preHandler: app.requireAuth }, async (request, reply) => {
    const media = await loadAuthorizedMedia(request, reply);
    if (!media) return;
    return reply.sendFile(media.thumbnailPath);
  });

  app.get("/api/media/:id/preview", { preHandler: app.requireAuth }, async (request, reply) => {
    const media = await loadAuthorizedMedia(request, reply);
    if (!media) return;
    // Falls back to the original when no smaller preview was generated (see ingest/thumbnail.ts).
    return reply.sendFile(media.previewPath ?? media.storagePath);
  });
}
