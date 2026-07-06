import { loadSettings, saveSettings, type Settings } from "../lib/settingsStore.js";

export function openSettingsModal(onClose: () => void): void {
  const settings = loadSettings();

  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-modal">
      <h2>Settings</h2>

      <label>Order
        <select name="orderMode">
          <option value="random">Random</option>
          <option value="captured_at">Date</option>
          <option value="filename">Alphabetical</option>
        </select>
      </label>

      <fieldset>
        <legend>Images</legend>
        <label class="checkbox-row"><input type="checkbox" name="autoAdvanceImages" /> Auto-advance</label>
        <label>After <input type="number" name="imageDurationSeconds" min="1" max="300" step="1" /> seconds</label>
      </fieldset>

      <fieldset>
        <legend>Videos</legend>
        <label class="checkbox-row"><input type="checkbox" name="autoAdvanceVideos" /> Auto-advance when finished</label>
      </fieldset>

      <label class="checkbox-row"><input type="checkbox" name="showNavButtons" /> Show back/next buttons</label>

      <button data-action="close">Close</button>
    </div>
  `;

  const orderModeEl = backdrop.querySelector<HTMLSelectElement>('[name="orderMode"]')!;
  const autoAdvanceImagesEl = backdrop.querySelector<HTMLInputElement>('[name="autoAdvanceImages"]')!;
  const imageDurationEl = backdrop.querySelector<HTMLInputElement>('[name="imageDurationSeconds"]')!;
  const autoAdvanceVideosEl = backdrop.querySelector<HTMLInputElement>('[name="autoAdvanceVideos"]')!;
  const showNavButtonsEl = backdrop.querySelector<HTMLInputElement>('[name="showNavButtons"]')!;

  orderModeEl.value = settings.orderMode;
  autoAdvanceImagesEl.checked = settings.autoAdvanceImages;
  imageDurationEl.value = String(settings.imageDurationSeconds);
  autoAdvanceVideosEl.checked = settings.autoAdvanceVideos;
  showNavButtonsEl.checked = settings.showNavButtons;

  function apply(partial: Partial<Settings>) {
    saveSettings({ ...settings, ...partial });
    Object.assign(settings, partial);
  }

  orderModeEl.addEventListener("change", () => apply({ orderMode: orderModeEl.value as Settings["orderMode"] }));
  autoAdvanceImagesEl.addEventListener("change", () => apply({ autoAdvanceImages: autoAdvanceImagesEl.checked }));
  imageDurationEl.addEventListener("change", () => {
    const seconds = Math.min(300, Math.max(1, Number(imageDurationEl.value) || 10));
    imageDurationEl.value = String(seconds);
    apply({ imageDurationSeconds: seconds });
  });
  autoAdvanceVideosEl.addEventListener("change", () => apply({ autoAdvanceVideos: autoAdvanceVideosEl.checked }));
  showNavButtonsEl.addEventListener("change", () => apply({ showNavButtons: showNavButtonsEl.checked }));

  function close() {
    backdrop.remove();
    document.removeEventListener("keydown", onKeydown);
    onClose();
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector('[data-action="close"]')?.addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);

  document.body.appendChild(backdrop);
}
