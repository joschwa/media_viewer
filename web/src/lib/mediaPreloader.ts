import type { MediaListItem } from "@media_viewer/shared";
import { mediaUrl } from "../api/client.js";

export type PreloadEntry =
  | { kind: "image"; blobUrl: string; sizeBytes: number }
  | { kind: "video"; element: HTMLVideoElement };

export type MediaPreloader = {
  get(id: number): PreloadEntry | undefined;
  has(id: number): boolean;
  keys(): number[];
  /** Resolves once the item is fully ready to display with no further network/decode work. */
  preload(item: MediaListItem): Promise<void>;
  evict(id: number): void;
  evictAll(): void;
};

async function preloadImage(item: MediaListItem): Promise<PreloadEntry> {
  const res = await fetch(mediaUrl(item.id, "preview"), { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to preload media ${item.id} (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  // Pay the decode cost now too, not just the download — otherwise a huge photo can still
  // stutter on first paint even with the bytes already local.
  const img = new Image();
  img.src = blobUrl;
  await img.decode().catch(() => undefined);

  return { kind: "image", blobUrl, sizeBytes: blob.size };
}

function preloadVideo(item: MediaListItem, hiddenContainer: HTMLElement): Promise<PreloadEntry> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = mediaUrl(item.id, "preview");

    function onReady() {
      cleanup();
      resolve({ kind: "video", element: video });
    }
    function onError() {
      cleanup();
      video.remove();
      reject(new Error(`Failed to preload media ${item.id}`));
    }
    function cleanup() {
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("error", onError);
    }

    video.addEventListener("canplaythrough", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
    hiddenContainer.appendChild(video);
  });
}

export function createMediaPreloader(): MediaPreloader {
  const cache = new Map<number, PreloadEntry>();
  const pending = new Map<number, Promise<void>>();

  const hiddenContainer = document.createElement("div");
  hiddenContainer.style.display = "none";
  document.body.appendChild(hiddenContainer);

  function evict(id: number): void {
    const entry = cache.get(id);
    if (!entry) return;
    if (entry.kind === "image") {
      URL.revokeObjectURL(entry.blobUrl);
    } else {
      // Just detaching isn't enough to actually free the buffered media data promptly (it'd wait
      // on GC) — clearing src + calling load() forces the browser to release it immediately.
      entry.element.pause();
      entry.element.removeAttribute("src");
      entry.element.load();
      entry.element.remove();
    }
    cache.delete(id);
  }

  return {
    get: (id) => cache.get(id),
    has: (id) => cache.has(id),
    keys: () => [...cache.keys()],
    async preload(item) {
      if (cache.has(item.id) || pending.has(item.id)) {
        await pending.get(item.id);
        return;
      }
      const promise = (item.mediaType === "image" ? preloadImage(item) : preloadVideo(item, hiddenContainer))
        .then((entry) => {
          cache.set(item.id, entry);
        })
        .finally(() => {
          pending.delete(item.id);
        });
      pending.set(item.id, promise);
      await promise;
    },
    evict,
    evictAll() {
      for (const id of [...cache.keys()]) evict(id);
      hiddenContainer.remove();
    },
  };
}
