import { api } from "../api/client.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "../lib/settingsStore.js";

export function openSettingsModal(username: string, onClose: () => void): void {
  let settings = loadSettings(username);

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

      <fieldset>
        <legend>Display</legend>
        <label class="checkbox-row"><input type="checkbox" name="showFavoriteIndicator" /> Favorite star</label>
        <label class="checkbox-row"><input type="checkbox" name="showWeightThumbs" /> Weight thumbs (\u{1F44D}/\u{1F44E})</label>
        <label class="checkbox-row"><input type="checkbox" name="showWeightNumber" /> Weight number</label>
        <label class="checkbox-row"><input type="checkbox" name="showTagging" /> Tagging</label>
        <label class="checkbox-row"><input type="checkbox" name="showVisibilityToggle" /> Visibility toggle</label>
        <label class="checkbox-row"><input type="checkbox" name="showExcludeButton" /> Exclude button</label>
        <label class="checkbox-row"><input type="checkbox" name="showMediaCounter" /> Media count (n / total)</label>
      </fieldset>

      <fieldset>
        <legend>Filters</legend>
        <label class="checkbox-row"><input type="checkbox" name="favoritesOnly" /> Favorites only</label>
        <label>Minimum weight <input type="number" name="minWeight" min="-100" max="100" step="1" /></label>
        <label class="checkbox-row"><input type="checkbox" name="showExcludedItems" /> Show excluded items</label>
        <div class="tag-filter-list"><em>Loading tags…</em></div>
      </fieldset>

      <div class="settings-actions">
        <button type="button" class="secondary" data-action="restore-defaults">Restore defaults</button>
        <button type="button" data-action="close">Close</button>
      </div>
    </div>
  `;

  const fieldEls = {
    orderMode: backdrop.querySelector<HTMLSelectElement>('[name="orderMode"]')!,
    autoAdvanceImages: backdrop.querySelector<HTMLInputElement>('[name="autoAdvanceImages"]')!,
    imageDurationSeconds: backdrop.querySelector<HTMLInputElement>('[name="imageDurationSeconds"]')!,
    autoAdvanceVideos: backdrop.querySelector<HTMLInputElement>('[name="autoAdvanceVideos"]')!,
    showNavButtons: backdrop.querySelector<HTMLInputElement>('[name="showNavButtons"]')!,
    showFavoriteIndicator: backdrop.querySelector<HTMLInputElement>('[name="showFavoriteIndicator"]')!,
    showWeightThumbs: backdrop.querySelector<HTMLInputElement>('[name="showWeightThumbs"]')!,
    showWeightNumber: backdrop.querySelector<HTMLInputElement>('[name="showWeightNumber"]')!,
    showTagging: backdrop.querySelector<HTMLInputElement>('[name="showTagging"]')!,
    showVisibilityToggle: backdrop.querySelector<HTMLInputElement>('[name="showVisibilityToggle"]')!,
    showExcludeButton: backdrop.querySelector<HTMLInputElement>('[name="showExcludeButton"]')!,
    showMediaCounter: backdrop.querySelector<HTMLInputElement>('[name="showMediaCounter"]')!,
    favoritesOnly: backdrop.querySelector<HTMLInputElement>('[name="favoritesOnly"]')!,
    minWeight: backdrop.querySelector<HTMLInputElement>('[name="minWeight"]')!,
    showExcludedItems: backdrop.querySelector<HTMLInputElement>('[name="showExcludedItems"]')!,
  };
  const tagFilterListEl = backdrop.querySelector<HTMLDivElement>(".tag-filter-list")!;

  let tagCheckboxes: { id: number; el: HTMLInputElement }[] = [];

  function populateFields(s: Settings) {
    fieldEls.orderMode.value = s.orderMode;
    fieldEls.autoAdvanceImages.checked = s.autoAdvanceImages;
    fieldEls.imageDurationSeconds.value = String(s.imageDurationSeconds);
    fieldEls.autoAdvanceVideos.checked = s.autoAdvanceVideos;
    fieldEls.showNavButtons.checked = s.showNavButtons;
    fieldEls.showFavoriteIndicator.checked = s.showFavoriteIndicator;
    fieldEls.showWeightThumbs.checked = s.showWeightThumbs;
    fieldEls.showWeightNumber.checked = s.showWeightNumber;
    fieldEls.showTagging.checked = s.showTagging;
    fieldEls.showVisibilityToggle.checked = s.showVisibilityToggle;
    fieldEls.showExcludeButton.checked = s.showExcludeButton;
    fieldEls.showMediaCounter.checked = s.showMediaCounter;
    fieldEls.favoritesOnly.checked = s.favoritesOnly;
    fieldEls.minWeight.value = String(s.minWeight);
    fieldEls.showExcludedItems.checked = s.showExcludedItems;
    for (const { id, el } of tagCheckboxes) {
      el.checked = s.filterTagIds.includes(id);
    }
  }

  function loadTagCheckboxes() {
    void api
      .listTags()
      .then((tags) => {
        if (tags.length === 0) {
          tagFilterListEl.innerHTML = "<em>No tags yet</em>";
          tagCheckboxes = [];
          return;
        }
        tagFilterListEl.innerHTML = "";
        tagCheckboxes = tags.map((tag) => {
          const label = document.createElement("label");
          label.className = "checkbox-row";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = settings.filterTagIds.includes(tag.id);
          checkbox.addEventListener("change", () => {
            const nextIds = checkbox.checked
              ? [...settings.filterTagIds, tag.id]
              : settings.filterTagIds.filter((id) => id !== tag.id);
            apply({ filterTagIds: nextIds });
          });
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(tag.name));
          tagFilterListEl.appendChild(label);
          return { id: tag.id, el: checkbox };
        });
      })
      .catch(() => {
        tagFilterListEl.innerHTML = "<em>Couldn't load tags</em>";
        tagCheckboxes = [];
      });
  }

  function apply(partial: Partial<Settings>) {
    settings = { ...settings, ...partial };
    saveSettings(username, settings);
  }

  populateFields(settings);
  loadTagCheckboxes();

  fieldEls.orderMode.addEventListener("change", () =>
    apply({ orderMode: fieldEls.orderMode.value as Settings["orderMode"] }),
  );
  fieldEls.autoAdvanceImages.addEventListener("change", () =>
    apply({ autoAdvanceImages: fieldEls.autoAdvanceImages.checked }),
  );
  fieldEls.imageDurationSeconds.addEventListener("change", () => {
    const seconds = Math.min(300, Math.max(1, Number(fieldEls.imageDurationSeconds.value) || 10));
    fieldEls.imageDurationSeconds.value = String(seconds);
    apply({ imageDurationSeconds: seconds });
  });
  fieldEls.autoAdvanceVideos.addEventListener("change", () =>
    apply({ autoAdvanceVideos: fieldEls.autoAdvanceVideos.checked }),
  );
  fieldEls.showNavButtons.addEventListener("change", () => apply({ showNavButtons: fieldEls.showNavButtons.checked }));
  fieldEls.showFavoriteIndicator.addEventListener("change", () =>
    apply({ showFavoriteIndicator: fieldEls.showFavoriteIndicator.checked }),
  );
  fieldEls.showWeightThumbs.addEventListener("change", () =>
    apply({ showWeightThumbs: fieldEls.showWeightThumbs.checked }),
  );
  fieldEls.showWeightNumber.addEventListener("change", () =>
    apply({ showWeightNumber: fieldEls.showWeightNumber.checked }),
  );
  fieldEls.showTagging.addEventListener("change", () => apply({ showTagging: fieldEls.showTagging.checked }));
  fieldEls.showVisibilityToggle.addEventListener("change", () =>
    apply({ showVisibilityToggle: fieldEls.showVisibilityToggle.checked }),
  );
  fieldEls.showExcludeButton.addEventListener("change", () =>
    apply({ showExcludeButton: fieldEls.showExcludeButton.checked }),
  );
  fieldEls.showMediaCounter.addEventListener("change", () =>
    apply({ showMediaCounter: fieldEls.showMediaCounter.checked }),
  );
  fieldEls.favoritesOnly.addEventListener("change", () => apply({ favoritesOnly: fieldEls.favoritesOnly.checked }));
  fieldEls.minWeight.addEventListener("change", () => {
    const weight = Math.min(100, Math.max(-100, Number(fieldEls.minWeight.value) || -100));
    fieldEls.minWeight.value = String(weight);
    apply({ minWeight: weight });
  });
  fieldEls.showExcludedItems.addEventListener("change", () =>
    apply({ showExcludedItems: fieldEls.showExcludedItems.checked }),
  );

  backdrop.querySelector('[data-action="restore-defaults"]')?.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings(username, settings);
    populateFields(settings);
  });

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
