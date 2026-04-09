import type { AuthSession } from "@/types";

const TOKEN_KEY = "health-track-token";
const SESSION_KEY = "health-track-session";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function saveSession(session: AuthSession) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function getToken() {
  return canUseStorage() ? window.localStorage.getItem(TOKEN_KEY) : null;
}

export function clearSession() {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(SESSION_KEY);
}

