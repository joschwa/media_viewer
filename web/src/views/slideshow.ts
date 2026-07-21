import type { MediaListItem, SessionInfo } from "@media_viewer/shared";
import { api, mediaUrl } from "../api/client.js";
import { openChangePasswordModal } from "../components/changePasswordModal.js";
import { openNavMenu } from "../components/navMenu.js";
import { openScanReportModal } from "../components/scanReportModal.js";
import { openSettingsModal } from "../components/settingsModal.js";
import { openUploadModal } from "../components/uploadModal.js";
import { createMediaPreloader } from "../lib/mediaPreloader.js";
import { loadSettings, SETTINGS_CHANGED_EVENT, type Settings } from "../lib/settingsStore.js";
import { bumpWeight, clampWeight } from "../lib/weightSteps.js";
import { weightedShuffle } from "../lib/weightedShuffle.js";
import { renderAdmin } from "./admin.js";

type LoggedInSession = Extract<SessionInfo, { loggedIn: true }>;

function applyFilters(items: MediaListItem[], settings: Settings): MediaListItem[] {
  return items.filter((item) => {
    if (item.isExcluded && !settings.showExcludedItems) return false;
    if (settings.favoritesOnly && !item.isFavorite) return false;
    if (item.weight < settings.minWeight) return false;
    if (settings.filterTagIds.length > 0 && !item.tags.some((tag) => settings.filterTagIds.includes(tag.id))) {
      return false;
    }
    return true;
  });
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
      <button class="hamburger" data-action="menu" aria-label="Menu">&#9776;</button>
    </div>
    <div class="media-frame"></div>
    <div class="nav-buttons">
      <button data-action="prev">&larr; Back</button>
      <span class="counter"></span>
      <button data-action="next">Next &rarr;</button>
    </div>
    <div class="media-controls">
      <div class="controls-row">
        <button class="exclude-toggle" data-action="exclude" title="Exclude"></button>
        <span class="weight-controls">
          <button data-action="weight-down" title="Lower weight">&#128078;</button>
          <input type="number" class="weight-value" min="-100" max="100" step="1" value="0" />
          <button data-action="weight-up" title="Raise weight">&#128077;</button>
        </span>
        <button class="favorite-toggle" data-action="favorite" title="Favorite">&#9734;</button>
        <button class="visibility-toggle" data-action="visibility"></button>
        <form class="tag-add-form">
          <input type="text" name="tagName" placeholder="Add tag" list="tag-suggestions" />
          <datalist id="tag-suggestions"></datalist>
          <button type="submit">Add</button>
        </form>
        <button class="delete-toggle" data-action="delete" title="Delete">&#128465;</button>
        <span class="delete-confirm" hidden>
          Delete this item?
          <button type="button" class="danger" data-action="delete-confirm">Delete</button>
          <button type="button" data-action="delete-cancel">Cancel</button>
        </span>
      </div>
      <div class="tag-chips"></div>
    </div>
  `;
  container.appendChild(wrap);

  const frameEl = wrap.querySelector<HTMLDivElement>(".media-frame")!;
  const counterEl = wrap.querySelector<HTMLSpanElement>(".counter")!;
  const navButtonsEl = wrap.querySelector<HTMLDivElement>(".nav-buttons")!;
  const prevBtn = wrap.querySelector<HTMLButtonElement>('[data-action="prev"]')!;
  const nextBtn = wrap.querySelector<HTMLButtonElement>('[data-action="next"]')!;
  const menuBtn = wrap.querySelector<HTMLButtonElement>('[data-action="menu"]')!;
  const favoriteBtn = wrap.querySelector<HTMLButtonElement>('[data-action="favorite"]')!;
  const weightControlsEl = wrap.querySelector<HTMLSpanElement>(".weight-controls")!;
  const weightValueEl = wrap.querySelector<HTMLInputElement>(".weight-value")!;
  const weightDownBtn = wrap.querySelector<HTMLButtonElement>('[data-action="weight-down"]')!;
  const weightUpBtn = wrap.querySelector<HTMLButtonElement>('[data-action="weight-up"]')!;
  const excludeBtn = wrap.querySelector<HTMLButtonElement>('[data-action="exclude"]')!;
  const visibilityBtn = wrap.querySelector<HTMLButtonElement>('[data-action="visibility"]')!;
  const tagChipsEl = wrap.querySelector<HTMLDivElement>(".tag-chips")!;
  const tagAddForm = wrap.querySelector<HTMLFormElement>(".tag-add-form")!;
  const tagNameInput = wrap.querySelector<HTMLInputElement>('[name="tagName"]')!;
  const tagSuggestionsEl = wrap.querySelector<HTMLDataListElement>("#tag-suggestions")!;
  const mediaControlsEl = wrap.querySelector<HTMLDivElement>(".media-controls")!;
  const deleteToggleBtn = wrap.querySelector<HTMLButtonElement>('[data-action="delete"]')!;
  const deleteConfirmEl = wrap.querySelector<HTMLSpanElement>(".delete-confirm")!;

  function refreshTagSuggestions() {
    void api
      .listTags()
      .then((tags) => {
        tagSuggestionsEl.innerHTML = tags.map((tag) => `<option value="${tag.name}"></option>`).join("");
      })
      .catch(() => undefined);
  }

  refreshTagSuggestions();

  let settings = loadSettings(session.username);
  let items: MediaListItem[] = [];
  let index = 0;
  let advanceTimer: ReturnType<typeof setTimeout> | null = null;
  let advancingVideoEl: HTMLVideoElement | null = null;
  let advancingVideoHandler: (() => void) | null = null;

  // Background prefetch: once the current item is fully loaded, start fetching upcoming items
  // one at a time so navigating forward feels instant. Purely an optimization layer — anything
  // not yet cached (or fetched too slowly to keep up) just falls back to loading on demand.
  const PRELOAD_AHEAD = 3;
  const PRELOAD_BEHIND = 2;
  const preloader = createMediaPreloader();
  let preloadPipelineRunning = false;

  async function runPreloadPipeline() {
    if (preloadPipelineRunning || items.length <= 1) return;
    preloadPipelineRunning = true;
    try {
      for (let offset = 1; offset <= PRELOAD_AHEAD; offset++) {
        const targetIndex = (index + offset) % items.length;
        if (targetIndex === index) break; // wrapped all the way around a tiny library
        const item = items[targetIndex];
        if (preloader.has(item.id)) continue;
        try {
          await preloader.preload(item);
        } catch {
          // Best-effort — a failed prefetch just falls back to normal loading when it becomes current.
        }
      }
    } finally {
      preloadPipelineRunning = false;
    }
  }

  function trimPreloadWindow() {
    if (items.length === 0) return;
    const keepIds = new Set<number>();
    for (let offset = -PRELOAD_BEHIND; offset <= PRELOAD_AHEAD; offset++) {
      const i = (((index + offset) % items.length) + items.length) % items.length;
      keepIds.add(items[i].id);
    }
    for (const id of preloader.keys()) {
      if (!keepIds.has(id)) preloader.evict(id);
    }
  }

  /** Kicks off the preload pipeline once `mediaEl` is fully ready — immediately if it already is
   * (e.g. reused from the preload cache), otherwise on the same "ready" signal used elsewhere. */
  function armReadyToPreloadNext(mediaEl: HTMLImageElement | HTMLVideoElement) {
    const trigger = () => void runPreloadPipeline();
    if (mediaEl instanceof HTMLVideoElement) {
      mediaEl.addEventListener("canplaythrough", trigger, { once: true });
      if (mediaEl.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) trigger();
    } else {
      mediaEl.addEventListener("load", trigger, { once: true });
      if (mediaEl.complete) trigger();
    }
  }

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

  /** Drops the current item out of the local view (e.g. just excluded, filter hides it) without a full reload. */
  function removeCurrentFromView() {
    items.splice(index, 1);
    if (index >= items.length) index = Math.max(0, items.length - 1);
    renderCurrent();
  }

  function renderControls() {
    if (items.length === 0) {
      mediaControlsEl.hidden = true;
      return;
    }
    mediaControlsEl.hidden = false;
    const item = items[index];

    favoriteBtn.hidden = !settings.showFavoriteIndicator;
    favoriteBtn.textContent = item.isFavorite ? "★" : "☆";
    favoriteBtn.setAttribute("aria-pressed", String(item.isFavorite));

    weightDownBtn.hidden = !settings.showWeightThumbs;
    weightUpBtn.hidden = !settings.showWeightThumbs;
    weightValueEl.hidden = !settings.showWeightNumber;
    weightControlsEl.hidden = !settings.showWeightThumbs && !settings.showWeightNumber;
    weightValueEl.value = String(item.weight);

    excludeBtn.hidden = !settings.showExcludeButton;
    excludeBtn.textContent = "🚫";
    excludeBtn.title = item.isExcluded ? "Include" : "Exclude";
    excludeBtn.setAttribute("aria-label", excludeBtn.title);
    excludeBtn.setAttribute("aria-pressed", String(item.isExcluded));

    const canEditVisibility = item.ownerId === session.userId || session.role === "admin";
    visibilityBtn.hidden = !settings.showVisibilityToggle;
    visibilityBtn.textContent = item.visibility === "public" ? "🌐 Public" : "🔒 Private";
    visibilityBtn.disabled = !canEditVisibility;

    tagChipsEl.hidden = !settings.showTagging;
    tagAddForm.hidden = !settings.showTagging;

    const canDelete = session.role === "admin" && settings.showDeleteButton;
    deleteToggleBtn.hidden = !canDelete;
    deleteConfirmEl.hidden = true;

    tagChipsEl.innerHTML = "";
    for (const tag of item.tags) {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag.name;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", async () => {
        const nextIds = item.tags.filter((t) => t.id !== tag.id).map((t) => t.id);
        const result = await api.updatePreferences(item.id, { tagIds: nextIds });
        item.tags = result.tags;
        renderControls();
      });
      chip.appendChild(removeBtn);
      tagChipsEl.appendChild(chip);
    }
  }

  function renderCurrent() {
    teardownCurrentMedia();
    frameEl.innerHTML = "";

    if (items.length === 0) {
      frameEl.innerHTML = '<p class="empty-state">No media to show yet.</p>';
      counterEl.textContent = "";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      renderControls();
      return;
    }

    prevBtn.disabled = false;
    nextBtn.disabled = false;

    const item = items[index];
    const cached = preloader.get(item.id);

    if (item.mediaType === "image") {
      const img = document.createElement("img");
      img.src = cached?.kind === "image" ? cached.blobUrl : mediaUrl(item.id, "preview");
      img.alt = item.originalFilename;
      frameEl.appendChild(img);
      armReadyToPreloadNext(img);
    } else if (cached?.kind === "video") {
      // Reuses the same element the preloader already buffered, instead of starting a fresh request.
      const video = cached.element;
      video.controls = true;
      video.currentTime = 0;
      frameEl.appendChild(video);
      video.play().catch(() => undefined);
      armReadyToPreloadNext(video);
    } else {
      const video = document.createElement("video");
      video.src = mediaUrl(item.id, "preview");
      video.controls = true;
      video.autoplay = true;
      video.muted = true; // browsers block unmuted autoplay; native controls let the viewer unmute
      frameEl.appendChild(video);
      armReadyToPreloadNext(video);
    }
    counterEl.hidden = !settings.showMediaCounter;
    counterEl.textContent = `${index + 1} / ${items.length}`;

    renderControls();
    armCurrentAdvance();
    trimPreloadWindow();
  }

  async function loadItems() {
    const apiOrderBy = settings.orderMode === "random" ? "none" : settings.orderMode;
    const fetched = await api.listMedia(apiOrderBy);
    const filtered = applyFilters(fetched, settings);
    items = settings.orderMode === "random" ? weightedShuffle(filtered, (item) => item.weight) : filtered;
    index = 0;
  }

  function applyNavButtonsVisibility() {
    navButtonsEl.hidden = !settings.showNavButtons;
  }

  function filtersChanged(a: Settings, b: Settings): boolean {
    return (
      a.favoritesOnly !== b.favoritesOnly ||
      a.minWeight !== b.minWeight ||
      a.showExcludedItems !== b.showExcludedItems ||
      a.filterTagIds.length !== b.filterTagIds.length ||
      a.filterTagIds.some((id) => !b.filterTagIds.includes(id))
    );
  }

  async function handleSettingsChanged(e: Event) {
    const newSettings = (e as CustomEvent<Settings>).detail;
    const orderChanged = newSettings.orderMode !== settings.orderMode;
    const needsReload = orderChanged || filtersChanged(newSettings, settings);
    settings = newSettings;
    applyNavButtonsVisibility();
    if (needsReload) {
      await loadItems();
    }
    renderCurrent();
  }
  window.addEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);

  function teardown() {
    teardownCurrentMedia();
    window.removeEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);
    preloader.evictAll();
  }

  function doLogout() {
    teardown();
    void api.logout().then(() => rerender());
  }

  function doOpenAdmin() {
    teardown();
    container.innerHTML = "";
    void renderAdmin(container, session, rerender);
  }

  /** Pauses whatever's playing before opening a modal, and resumes (or re-arms) it on close. */
  function withPausedMedia(open: (onClose: () => void) => void) {
    teardownCurrentMedia();
    // Actually pause video playback too, not just the "ended" listener — otherwise a short
    // video can finish while the modal is open and never fire "ended" again once we resume.
    const openVideoEl = frameEl.querySelector("video");
    openVideoEl?.pause();
    open(() => {
      // Resume for whatever's on screen — a no-op re-arm if a live setting change already
      // re-rendered while the modal was open, or a fresh arm if nothing changed.
      teardownCurrentMedia();
      openVideoEl?.play().catch(() => undefined);
      armCurrentAdvance();
    });
  }

  function doOpenSettings() {
    withPausedMedia((onClose) => openSettingsModal(session.username, session.role, onClose));
  }

  function doOpenUpload() {
    withPausedMedia((onClose) => openUploadModal(onClose));
  }

  function doOpenChangePassword() {
    withPausedMedia((onClose) => openChangePasswordModal(onClose));
  }

  function doTriggerScan() {
    withPausedMedia((onClose) => openScanReportModal(onClose));
  }

  menuBtn.addEventListener("click", () => {
    openNavMenu(
      {
        username: session.username,
        role: session.role,
        isAdmin: session.role === "admin",
        onSettings: doOpenSettings,
        onAdmin: doOpenAdmin,
        onUpload: doOpenUpload,
        onChangePassword: doOpenChangePassword,
        onTriggerScan: doTriggerScan,
        onLogout: doLogout,
      },
      () => undefined,
    );
  });

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  favoriteBtn.addEventListener("click", async () => {
    if (items.length === 0) return;
    const item = items[index];
    const result = await api.updatePreferences(item.id, { isFavorite: !item.isFavorite });
    item.isFavorite = result.isFavorite;
    item.weight = result.weight;
    item.isExcluded = result.isExcluded;
    item.tags = result.tags;
    renderControls();
  });

  async function bumpItemWeight(direction: 1 | -1) {
    if (items.length === 0) return;
    const item = items[index];
    const result = await api.updatePreferences(item.id, { weight: bumpWeight(item.weight, direction) });
    item.isFavorite = result.isFavorite;
    item.weight = result.weight;
    item.isExcluded = result.isExcluded;
    item.tags = result.tags;
    renderControls();
  }
  weightDownBtn.addEventListener("click", () => bumpItemWeight(-1));
  weightUpBtn.addEventListener("click", () => bumpItemWeight(1));

  weightValueEl.addEventListener("change", async () => {
    if (items.length === 0) return;
    const item = items[index];
    const weight = clampWeight(Number(weightValueEl.value));
    const result = await api.updatePreferences(item.id, { weight });
    item.isFavorite = result.isFavorite;
    item.weight = result.weight;
    item.isExcluded = result.isExcluded;
    item.tags = result.tags;
    renderControls();
  });

  excludeBtn.addEventListener("click", async () => {
    if (items.length === 0) return;
    const item = items[index];
    const result = await api.updatePreferences(item.id, { isExcluded: !item.isExcluded });
    item.isFavorite = result.isFavorite;
    item.weight = result.weight;
    item.isExcluded = result.isExcluded;
    item.tags = result.tags;
    if (item.isExcluded && !settings.showExcludedItems) {
      removeCurrentFromView();
    } else {
      renderControls();
    }
  });

  visibilityBtn.addEventListener("click", async () => {
    if (items.length === 0) return;
    const item = items[index];
    const canEdit = item.ownerId === session.userId || session.role === "admin";
    if (!canEdit) return;
    const nextVisibility = item.visibility === "public" ? "private" : "public";
    const result = await api.updateVisibility(item.id, nextVisibility);
    item.visibility = result.visibility;
    renderControls();
  });

  tagAddForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (items.length === 0) return;
    const name = tagNameInput.value.trim();
    if (!name) return;
    const item = items[index];
    const tag = await api.createTag(name);
    tagNameInput.value = "";
    if (item.tags.some((t) => t.id === tag.id)) return;
    const nextIds = [...item.tags.map((t) => t.id), tag.id];
    const result = await api.updatePreferences(item.id, { tagIds: nextIds });
    item.tags = result.tags;
    renderControls();
    refreshTagSuggestions();
  });

  deleteToggleBtn.addEventListener("click", () => {
    deleteToggleBtn.hidden = true;
    deleteConfirmEl.hidden = false;
  });

  wrap.querySelector('[data-action="delete-cancel"]')?.addEventListener("click", () => {
    renderControls();
  });

  wrap.querySelector('[data-action="delete-confirm"]')?.addEventListener("click", async () => {
    if (items.length === 0) return;
    const item = items[index];
    await api.deleteMedia(item.id);
    removeCurrentFromView();
  });

  applyNavButtonsVisibility();
  await loadItems();
  renderCurrent();
}
