export type SlideOrderMode = "random" | "captured_at" | "filename";

export type Settings = {
  orderMode: SlideOrderMode;
  autoAdvanceImages: boolean;
  imageDurationSeconds: number;
  autoAdvanceVideos: boolean;
  showNavButtons: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  orderMode: "captured_at",
  autoAdvanceImages: true,
  imageDurationSeconds: 10,
  autoAdvanceVideos: true,
  showNavButtons: true,
};

const STORAGE_KEY = "media_viewer_settings";
export const SETTINGS_CHANGED_EVENT = "settings:changed";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    // Spread over the defaults so a settings shape from an older version of the app
    // (missing fields, since we never version this) still yields a fully-populated Settings.
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent<Settings>(SETTINGS_CHANGED_EVENT, { detail: settings }));
}
