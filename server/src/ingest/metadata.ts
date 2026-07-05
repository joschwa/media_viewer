import exifr from "exifr";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";

export type MediaMetadata = {
  width: number;
  height: number;
  durationSeconds: number | null;
  capturedAt: Date | null;
};

async function extractImageMetadata(filePath: string): Promise<MediaMetadata> {
  const sharpMeta = await sharp(filePath).metadata();
  let capturedAt: Date | null = null;
  try {
    const exif = await exifr.parse(filePath, ["DateTimeOriginal", "CreateDate"]);
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (raw instanceof Date) capturedAt = raw;
  } catch {
    // Not all images carry EXIF (e.g. screenshots, PNGs) — captured_at falls back to imported_at.
  }
  return {
    width: sharpMeta.width ?? 0,
    height: sharpMeta.height ?? 0,
    durationSeconds: null,
    capturedAt,
  };
}

function ffprobeAsync(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function extractVideoMetadata(filePath: string): Promise<MediaMetadata> {
  const probe = await ffprobeAsync(filePath);
  const videoStream = probe.streams.find((s) => s.codec_type === "video");
  const creationTime = probe.format.tags?.creation_time as string | undefined;
  return {
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    durationSeconds: probe.format.duration ? Number(probe.format.duration) : null,
    capturedAt: creationTime ? new Date(creationTime) : null,
  };
}

export async function extractMetadata(filePath: string, mediaType: "image" | "video"): Promise<MediaMetadata> {
  return mediaType === "image" ? extractImageMetadata(filePath) : extractVideoMetadata(filePath);
}
