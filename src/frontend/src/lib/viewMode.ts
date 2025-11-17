export type ViewMode = "student" | "teacher";

export const VIEW_MODE_STORAGE_KEY = "bitbybit_view_mode";
export const VIEW_MODE_EVENT = "bitbybit:view-mode-updated";

export function readStoredViewMode(): ViewMode {
  if (typeof window === "undefined") {
    return "student";
  }
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === "teacher" ? "teacher" : "student";
}

export function persistViewMode(mode: ViewMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new Event(VIEW_MODE_EVENT));
}

export function clearStoredViewMode() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(VIEW_MODE_STORAGE_KEY);
  window.dispatchEvent(new Event(VIEW_MODE_EVENT));
}
