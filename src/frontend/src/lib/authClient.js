import { apiPost } from "./apiClient";

const USER_STORAGE_KEY = "bitbybit_user";
export const AUTH_EVENT = "bitbybit:user-updated";

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export async function login(email, password) {
  return apiPost("/auth/login", { email, password });
}

export async function forgotPassword(email) {
  return apiPost("/auth/forgot-password", { email });
}

export function getCurrentUser() {
  const win = safeWindow();
  if (!win) return null;
  try {
    const raw = win.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Unable to parse stored user", err);
    return null;
  }
}

export function setCurrentUser(user) {
  const win = safeWindow();
  if (!win) return;
  if (user) {
    win.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    win.localStorage.removeItem(USER_STORAGE_KEY);
  }
  try {
    win.dispatchEvent(
      new CustomEvent(AUTH_EVENT, {
        detail: user,
      })
    );
  } catch {
    win.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export function clearCurrentUser() {
  setCurrentUser(null);
}
