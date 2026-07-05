import { fileTypeFromFile } from "file-type";

export type SniffedMedia = { mediaType: "image" | "video"; mimeType: string; ext: string };

/** Sniffs real file type from magic bytes rather than trusting the extension. Returns null for anything unsupported. */
export async function sniffMedia(filePath: string): Promise<SniffedMedia | null> {
  const detected = await fileTypeFromFile(filePath);
  if (!detected) return null;

  if (detected.mime.startsWith("image/")) {
    return { mediaType: "image", mimeType: detected.mime, ext: `.${detected.ext}` };
  }
  if (detected.mime.startsWith("video/")) {
    return { mediaType: "video", mimeType: detected.mime, ext: `.${detected.ext}` };
  }
  return null;
}
