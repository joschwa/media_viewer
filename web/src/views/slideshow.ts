import type { MediaListItem, SessionInfo } from "@media_viewer/shared";
import { api, mediaUrl } from "../api/client.js";
import { openSettingsModal } from "../components/settingsModal.js";
import { loadSettings, SETTINGS_CHANGED_EVENT, type Settings } from "../lib/settingsStore.js";
import { renderAdmin } from "./admin.js";

type LoggedInSession = Extract<SessionInfo, { loggedIn: true }>;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function renderSlideshow(
  container: HTMLElement,
  session: LoggedInSession,
  rerender: () => void,
): Promise<void> {
  const wrap = document.createElement("div");
  wrap.className = "slideshow";
  wrap.innerHTML = `
    <div class="top-bar">
      <span>${session.username} (${session.role})</span>
      <span>
        <button data-action="settings">Settings</button>
        ${session.role === "admin" ? '<button data-action="admin">Admin</button>' : ""}
        <button data-action="logout">Log out</button>
      </span>
    </div>
    <div class="media-frame"></div>
    <div class="nav-buttons">
      <button data-action="prev">&larr; Back</button>
      <span class="counter"></span>
      <button data-action="next">Next &rarr;</button>
    </div>
  `;
  container.appendChild(wrap);

  const frameEl = wrap.querySelector<HTMLDivElement>(".media-frame")!;
  const counterEl = wrap.querySelector<HTMLSpanElement>(".counter")!;
  const navButtonsEl = wrap.querySelector<HTMLDivElement>(".nav-buttons")!;
  const prevBtn = wrap.querySelector<HTMLButtonElement>('[data-action="prev"]')!;
  const nextBtn = wrap.querySelector<HTMLButtonElement>('[data-action="next"]')!;

  let settings = loadSettings();
  let items: MediaListItem[] = [];
  let index = 0;
  let advanceTimer: ReturnType<typeof setTimeout> | null = null;
  let advancingVideoEl: HTMLVideoElement | null = null;
  let advancingVideoHandler: (() => void) | null = null;

  function teardownCurrentMedia() {
    if (advanceTimer !== null) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
    if (advancingVideoEl && advancingVideoHandler) {
      advancingVideoEl.removeEventListener("ended", advancingVideoHandler);
    }
    advancingVideoEl = null;
    advancingVideoHandler = null;
  }

  /** (Re-)arms the timer/ended-listener for whatever is currently mounted, per current settings. */
  function armCurrentAdvance() {
    if (items.length === 0) return;
    const item = items[index];
    if (item.mediaType === "image") {
      if (settings.autoAdvanceImages) {
        advanceTimer = setTimeout(next, settings.imageDurationSeconds * 1000);
      }
    } else if (settings.autoAdvanceVideos) {
      const videoEl = frameEl.querySelector("video");
      if (videoEl) {
        const handler = () => next();
        videoEl.addEventListener("ended", handler);
        advancingVideoEl = videoEl;
        advancingVideoHandler = handler;
      }
    }
  }

  function next() {
    if (items.length === 0) return;
    index = (index + 1) % items.length;
    renderCurrent();
  }
  function prev() {
    if (items.length === 0) return;
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  }

  function renderCurrent() {
    teardownCurrentMedia();
    frameEl.innerHTML = "";

    if (items.length === 0) {
      frameEl.innerHTML = '<p class="empty-state">No media to show yet.</p>';
      counterEl.textContent = "";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    prevBtn.disabled = false;
    nextBtn.disabled = false;

    const item = items[index];
    if (item.mediaType === "image") {
      const img = document.createElement("img");
      img.src = mediaUrl(item.id, "preview");
      img.alt = item.originalFilename;
      frameEl.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = mediaUrl(item.id, "preview");
      video.controls = true;
      video.autoplay = true;
      video.muted = true; // browsers block unmuted autoplay; native controls let the viewer unmute
      frameEl.appendChild(video);
    }
    counterEl.textContent = `${index + 1} / ${items.length}`;

    armCurrentAdvance();
  }

  async function loadItems() {
    const apiOrderBy = settings.orderMode === "random" ? "none" : settings.orderMode;
    const fetched = await api.listMedia(apiOrderBy);
    items = settings.orderMode === "random" ? shuffle(fetched) : fetched;
    index = 0;
  }

  function applyNavButtonsVisibility() {
    navButtonsEl.hidden = !settings.showNavButtons;
  }

  async function handleSettingsChanged(e: Event) {
    const newSettings = (e as CustomEvent<Settings>).detail;
    const orderChanged = newSettings.orderMode !== settings.orderMode;
    settings = newSettings;
    applyNavButtonsVisibility();
    if (orderChanged) {
      await loadItems();
    }
    renderCurrent();
  }
  window.addEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);

  function teardown() {
    teardownCurrentMedia();
    window.removeEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);
  }

  wrap.querySelector('[data-action="logout"]')?.addEventListener("click", async () => {
    teardown();
    await api.logout();
    rerender();
  });
  wrap.querySelector('[data-action="admin"]')?.addEventListener("click", () => {
    teardown();
    container.innerHTML = "";
    void renderAdmin(container, rerender);
  });
  wrap.querySelector('[data-action="settings"]')?.addEventListener("click", () => {
    teardownCurrentMedia();
    // Actually pause video playback too, not just the "ended" listener — otherwise a short
    // video can finish while the modal is open and never fire "ended" again once we resume.
    const openVideoEl = frameEl.querySelector("video");
    openVideoEl?.pause();
    openSettingsModal(() => {
      // Resume for whatever's on screen — a no-op re-arm if a live setting change already
      // re-rendered while the modal was open, or a fresh arm if nothing changed.
      teardownCurrentMedia();
      openVideoEl?.play().catch(() => undefined);
      armCurrentAdvance();
    });
  });

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  applyNavButtonsVisibility();
  await loadItems();
  renderCurrent();
}
