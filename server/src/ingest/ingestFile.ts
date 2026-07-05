import { copyFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { absolutePath, duplicatesDir, ensureParentDir, quarantineDir, relativeStoragePath } from "../storage/paths.js";
import { hashFile } from "./hash.js";
import { extractMetadata } from "./metadata.js";
import { sniffMedia } from "./mimeSniff.js";
import {
  generateImagePreview,
  generateImageThumbnail,
  generateVideoPreview,
  generateVideoThumbnail,
} from "./thumbnail.js";

export type IngestOutcome =
  | { status: "imported"; mediaId: number }
  | { status: "duplicate" }
  | { status: "quarantined"; reason: string };

async function moveFile(src: string, dest: string): Promise<void> {
  await ensureParentDir(dest);
  try {
    await rename(src, dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      await copyFile(src, dest);
      await unlink(src);
    } else {
      throw err;
    }
  }
}

/** Moves whatever's currently at `currentPath` into quarantine with a sibling error note; swallows a missing-file error. */
async function quarantine(currentPath: string, reason: string): Promise<void> {
  try {
    const dest = path.join(quarantineDir(), path.basename(currentPath));
    await moveFile(currentPath, dest);
    await writeFile(`${dest}.error.txt`, reason, "utf8");
  } catch {
    // The file may already be gone (e.g. it made it into storage/ before the failure) — nothing left to quarantine.
  }
}

export async function ingestFile(sourcePath: string, ownerId: number): Promise<IngestOutcome> {
  let currentPath = sourcePath;
  try {
    const sniffed = await sniffMedia(sourcePath);
    if (!sniffed) {
      const reason = "Unrecognized or unsupported file type";
      await quarantine(currentPath, reason);
      return { status: "quarantined", reason };
    }

    const contentHash = await hashFile(sourcePath);
    const existing = await prisma.mediaItem.findUnique({ where: { contentHash } });
    if (existing) {
      const dest = path.join(duplicatesDir(), path.basename(sourcePath));
      await moveFile(currentPath, dest);
      return { status: "duplicate" };
    }

    const metadata = await extractMetadata(sourcePath, sniffed.mediaType);
    const capturedAt = metadata.capturedAt ?? new Date();

    const originalRelPath = relativeStoragePath("originals", capturedAt, contentHash, sniffed.ext);
    const thumbnailRelPath = relativeStoragePath("thumbnails", capturedAt, contentHash, ".jpg");
    const previewRelPath = relativeStoragePath(
      "previews",
      capturedAt,
      contentHash,
      sniffed.mediaType === "image" ? ".jpg" : ".mp4",
    );

    const thumbnailAbsPath = absolutePath(thumbnailRelPath);
    const previewAbsPath = absolutePath(previewRelPath);
    await ensureParentDir(thumbnailAbsPath);
    await ensureParentDir(previewAbsPath);

    let previewGenerated: boolean;
    if (sniffed.mediaType === "image") {
      await generateImageThumbnail(sourcePath, thumbnailAbsPath);
      previewGenerated = await generateImagePreview(sourcePath, previewAbsPath, metadata.width, metadata.height);
    } else {
      await generateVideoThumbnail(sourcePath, thumbnailAbsPath);
      previewGenerated = await generateVideoPreview(sourcePath, previewAbsPath, metadata.height);
    }

    const originalAbsPath = absolutePath(originalRelPath);
    await moveFile(currentPath, originalAbsPath);
    currentPath = originalAbsPath;

    const { size } = await stat(originalAbsPath);

    const created = await prisma.mediaItem.create({
      data: {
        contentHash,
        mediaType: sniffed.mediaType,
        originalFilename: path.basename(sourcePath),
        storagePath: originalRelPath,
        thumbnailPath: thumbnailRelPath,
        previewPath: previewGenerated ? previewRelPath : null,
        mimeType: sniffed.mimeType,
        width: metadata.width,
        height: metadata.height,
        durationSeconds: metadata.durationSeconds,
        capturedAt: metadata.capturedAt,
        fileSizeBytes: BigInt(size),
        ownerId,
        visibility: "private",
      },
    });

    return { status: "imported", mediaId: created.id };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await quarantine(currentPath, reason);
    return { status: "quarantined", reason };
  }
}
