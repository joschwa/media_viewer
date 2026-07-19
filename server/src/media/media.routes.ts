import type { MediaItem } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ingestFile } from "../ingest/ingestFile.js";
import { absolutePath, ensureBaseDirs, uploadsTmpDir } from "../storage/paths.js";

/** Unlinks a media item's on-disk files (original/thumbnail/preview). Tolerant of files already
 * being gone, matching the same tolerance pattern used by ingestFile.ts's quarantine(). */
export async function deleteMediaFiles(media: Pick<MediaItem, "storagePath" | "thumbnailPath" | "previewPath">): Promise<void> {
  await unlink(absolutePath(media.storagePath)).catch(() => undefined);
  await unlink(absolutePath(media.thumbnailPath)).catch(() => undefined);
  if (media.previewPath) {
    await unlink(absolutePath(media.previewPath)).catch(() => undefined);
  }
}

const listQuerySchema = z.object({
  orderBy: z.enum(["captured_at", "filename", "none"]).default("captured_at"),
  mine: z.enum(["true", "false"]).optional(),
});

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

const visibilityBodySchema = z.object({ visibility: z.enum(["private", "public"]) });

const preferencesBodySchema = z.object({
  isFavorite: z.boolean().optional(),
  weight: z.number().int().min(-100).max(100).optional(),
  isExcluded: z.boolean().optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

/** Strips any path components and anything but a conservative charset, so a malicious client-supplied
 * filename can never escape uploads-tmp/ or otherwise do anything surprising on disk. */
function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return base.length > 0 ? base : "upload";
}

type MediaWithMyData = MediaItem & {
  preferences: { isFavorite: boolean; weight: number; isExcluded: boolean }[];
  tagAssignments: { tag: { id: number; name: string } }[];
};

function toListItem(media: MediaWithMyData) {
  const myPreference = media.preferences[0];
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
    isFavorite: myPreference?.isFavorite ?? false,
    weight: myPreference?.weight ?? 0,
    isExcluded: myPreference?.isExcluded ?? false,
    tags: media.tagAssignments.map((a) => a.tag),
  };
}

/** Loads a media item and enforces the owner-or-public visibility rule; replies 404/403 itself on failure. */
async function loadAuthorizedMedia(request: FastifyRequest, reply: FastifyReply): Promise<MediaItem | null> {
  const { id } = idParamSchema.parse(request.params);

  const media = await prisma.mediaItem.findUnique({ where: { id } });
  if (!media) {
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
      where: visibilityFilter,
      orderBy,
      include: {
        preferences: { where: { userId: user.id }, select: { isFavorite: true, weight: true, isExcluded: true } },
        tagAssignments: { where: { userId: user.id }, include: { tag: true } },
      },
    });

    reply.send(items.map(toListItem));
  });

  app.post(
    "/api/media/upload",
    { preHandler: app.requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const user = request.currentUser!;
      await ensureBaseDirs();

      const results: { filename: string; status: "imported" | "duplicate" | "quarantined"; reason?: string }[] = [];

      for await (const part of request.files()) {
        const originalFilename = part.filename;
        const tempPath = path.join(uploadsTmpDir(), `${randomUUID()}-${sanitizeFilename(originalFilename)}`);

        try {
          await pipeline(part.file, createWriteStream(tempPath));
        } catch {
          await unlink(tempPath).catch(() => undefined);
          results.push({ filename: originalFilename, status: "quarantined", reason: "Upload failed or exceeded the size limit" });
          continue;
        }

        // Uploads are always attributed to (and private to) the uploader — never `main`, unlike scanIncoming().
        const outcome = await ingestFile(tempPath, user.id, originalFilename);
        if (outcome.status === "quarantined") {
          results.push({ filename: originalFilename, status: "quarantined", reason: outcome.reason });
        } else {
          results.push({ filename: originalFilename, status: outcome.status });
        }
      }

      reply.send({ results });
    },
  );

  app.patch("/api/media/:id/visibility", { preHandler: app.requireAuth }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = visibilityBodySchema.parse(request.body);
    const user = request.currentUser!;

    const media = await prisma.mediaItem.findUnique({ where: { id } });
    if (!media) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    if (media.ownerId !== user.id && user.role !== "admin") {
      reply.code(403).send({ error: "Forbidden" });
      return;
    }

    const updated = await prisma.mediaItem.update({ where: { id }, data: { visibility: body.visibility } });
    reply.send({ id: updated.id, visibility: updated.visibility });
  });

  app.delete("/api/media/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);

    const media = await prisma.mediaItem.findUnique({ where: { id } });
    if (!media) {
      reply.code(404).send({ error: "Not found" });
      return;
    }

    // Hard delete — all media on this service is expected to be a duplicate of something that
    // exists elsewhere (a phone's camera roll, etc.), so this doesn't carry the same data-loss
    // risk a sole archival copy would. `preferences`/`tagAssignments` cascade away via the schema.
    await deleteMediaFiles(media);
    await prisma.mediaItem.delete({ where: { id } });
    reply.send({ id, deleted: true });
  });

  app.patch("/api/media/:id/preferences", { preHandler: app.requireAuth }, async (request, reply) => {
    const body = preferencesBodySchema.parse(request.body);
    const user = request.currentUser!;

    const media = await loadAuthorizedMedia(request, reply);
    if (!media) return;

    if (body.isFavorite !== undefined || body.weight !== undefined || body.isExcluded !== undefined) {
      await prisma.userMediaPreference.upsert({
        where: { userId_mediaId: { userId: user.id, mediaId: media.id } },
        create: {
          userId: user.id,
          mediaId: media.id,
          isFavorite: body.isFavorite ?? false,
          weight: body.weight ?? 0,
          isExcluded: body.isExcluded ?? false,
        },
        update: {
          ...(body.isFavorite !== undefined ? { isFavorite: body.isFavorite } : {}),
          ...(body.weight !== undefined ? { weight: body.weight } : {}),
          ...(body.isExcluded !== undefined ? { isExcluded: body.isExcluded } : {}),
        },
      });
    }

    if (body.tagIds !== undefined) {
      await prisma.$transaction([
        prisma.userMediaTag.deleteMany({ where: { userId: user.id, mediaId: media.id } }),
        prisma.userMediaTag.createMany({
          data: body.tagIds.map((tagId) => ({ userId: user.id, mediaId: media.id, tagId })),
        }),
      ]);
    }

    const preference = await prisma.userMediaPreference.findUnique({
      where: { userId_mediaId: { userId: user.id, mediaId: media.id } },
    });
    const tagAssignments = await prisma.userMediaTag.findMany({
      where: { userId: user.id, mediaId: media.id },
      include: { tag: true },
    });

    reply.send({
      isFavorite: preference?.isFavorite ?? false,
      weight: preference?.weight ?? 0,
      isExcluded: preference?.isExcluded ?? false,
      tags: tagAssignments.map((a) => a.tag),
    });
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
