export type SlideOrderMode = "random" | "captured_at" | "filename";

export type Settings = {
  orderMode: SlideOrderMode;
  autoAdvanceImages: boolean;
  imageDurationSeconds: number;
  autoAdvanceVideos: boolean;
  showNavButtons: boolean;
  favoritesOnly: boolean;
  minWeight: number;
  filterTagIds: number[];
  showExcludedItems: boolean;
  showFavoriteIndicator: boolean;
  showWeightThumbs: boolean;
  showWeightNumber: boolean;
  showTagging: boolean;
  showVisibilityToggle: boolean;
  showExcludeButton: boolean;
  showMediaCounter: boolean;
  showDeleteButton: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  orderMode: "captured_at",
  autoAdvanceImages: true,
  imageDurationSeconds: 10,
  autoAdvanceVideos: true,
  showNavButtons: true,
  favoritesOnly: false,
  minWeight: -100,
  filterTagIds: [],
  showExcludedItems: false,
  showFavoriteIndicator: false,
  showWeightThumbs: true,
  showWeightNumber: false,
  showTagging: true,
  showVisibilityToggle: false,
  showExcludeButton: false,
  showMediaCounter: false,
  showDeleteButton: false,
};

const STORAGE_KEY_PREFIX = "media_viewer_settings";
export const SETTINGS_CHANGED_EVENT = "settings:changed";

// Settings are stored per-username so switching accounts on the same browser doesn't leak
// one user's display/filter preferences into another user's slideshow.
function storageKey(username: string): string {
  return `${STORAGE_KEY_PREFIX}:${username}`;
}

export function loadSettings(username: string): Settings {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return { ...DEFAULT_SETTINGS };
    // Spread over the defaults so a settings shape from an older version of the app
    // (missing fields, since we never version this) still yields a fully-populated Settings.
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(username: string, settings: Settings): void {
  localStorage.setItem(storageKey(username), JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent<Settings>(SETTINGS_CHANGED_EVENT, { detail: settings }));
}
