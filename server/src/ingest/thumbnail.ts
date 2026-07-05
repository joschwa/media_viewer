import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";

const THUMBNAIL_MAX_EDGE = 400;
const PREVIEW_MAX_IMAGE_EDGE = 1920;
const PREVIEW_MAX_VIDEO_HEIGHT = 720;

export async function generateImageThumbnail(sourcePath: string, destPath: string): Promise<void> {
  await sharp(sourcePath)
    .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(destPath);
}

/** Only produces a file when the original exceeds the preview cap — avoids pointless re-encoding on a Pi. */
export async function generateImagePreview(
  sourcePath: string,
  destPath: string,
  width: number,
  height: number,
): Promise<boolean> {
  if (Math.max(width, height) <= PREVIEW_MAX_IMAGE_EDGE) return false;
  await sharp(sourcePath)
    .resize(PREVIEW_MAX_IMAGE_EDGE, PREVIEW_MAX_IMAGE_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(destPath);
  return true;
}

export function generateVideoThumbnail(sourcePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .on("end", () => resolve())
      .on("error", reject)
      .screenshots({
        timestamps: ["1"],
        filename: path.basename(destPath),
        folder: path.dirname(destPath),
        size: `${THUMBNAIL_MAX_EDGE}x?`,
      });
  });
}

/** Only transcodes when the source exceeds the resolution cap — otherwise the client just streams the original. */
export function generateVideoPreview(sourcePath: string, destPath: string, height: number): Promise<boolean> {
  if (height <= PREVIEW_MAX_VIDEO_HEIGHT) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .videoFilters(`scale=-2:${PREVIEW_MAX_VIDEO_HEIGHT}`)
      .videoBitrate("2000k")
      .outputOptions(["-c:v libx264", "-c:a aac"])
      .on("end", () => resolve(true))
      .on("error", reject)
      .save(destPath);
  });
}
