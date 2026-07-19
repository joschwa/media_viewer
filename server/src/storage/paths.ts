import { mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export const incomingDir = () => path.join(config.mediaRoot, "incoming");
export const duplicatesDir = () => path.join(incomingDir(), "duplicates");
export const quarantineDir = () => path.join(config.mediaRoot, "quarantine");
// Uploads land here (not in incoming/) so an in-flight web upload can never be picked up
// mid-write by a concurrent admin-triggered scan of incoming/.
export const uploadsTmpDir = () => path.join(config.mediaRoot, "uploads-tmp");

type StorageKind = "originals" | "thumbnails" | "previews";

/** Relative (to MEDIA_ROOT) path for a stored file, bucketed by capture year/month and a 2-char hash prefix. */
export function relativeStoragePath(kind: StorageKind, capturedAt: Date, contentHash: string, ext: string): string {
  const year = String(capturedAt.getUTCFullYear());
  const month = String(capturedAt.getUTCMonth() + 1).padStart(2, "0");
  const prefix = contentHash.slice(0, 2);
  return path.join("storage", kind, year, month, prefix, `${contentHash}${ext}`);
}

export function absolutePath(relativePath: string): string {
  return path.join(config.mediaRoot, relativePath);
}

export async function ensureBaseDirs(): Promise<void> {
  await mkdir(incomingDir(), { recursive: true });
  await mkdir(duplicatesDir(), { recursive: true });
  await mkdir(quarantineDir(), { recursive: true });
  await mkdir(uploadsTmpDir(), { recursive: true });
  await mkdir(path.join(config.mediaRoot, "storage", "originals"), { recursive: true });
  await mkdir(path.join(config.mediaRoot, "storage", "thumbnails"), { recursive: true });
  await mkdir(path.join(config.mediaRoot, "storage", "previews"), { recursive: true });
}

export async function ensureParentDir(absoluteFilePath: string): Promise<void> {
  await mkdir(path.dirname(absoluteFilePath), { recursive: true });
}
