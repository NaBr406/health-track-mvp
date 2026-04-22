/**
 * 本地保存和清理登录会话的小型工具。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "../types";

const TOKEN_KEY = "health-track-mobile-token";
const SESSION_KEY = "health-track-mobile-session";
type StoredSessionInvalidationListener = () => void | Promise<void>;

let storedSessionInvalidationListener: StoredSessionInvalidationListener | null = null;
let storedSessionInvalidationTask: Promise<void> | null = null;

export async function saveStoredSession(session: AuthSession) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, session.token],
    [SESSION_KEY, JSON.stringify(session)]
  ]);
}

export async function loadStoredSession() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function loadToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearStoredSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
}

export function setStoredSessionInvalidationListener(listener: StoredSessionInvalidationListener | null) {
  storedSessionInvalidationListener = listener;
}

export async function invalidateStoredSession() {
  if (storedSessionInvalidationTask) {
    await storedSessionInvalidationTask;
    return;
  }

  storedSessionInvalidationTask = (async () => {
    await clearStoredSession();
    await storedSessionInvalidationListener?.();
  })().finally(() => {
    storedSessionInvalidationTask = null;
  });

  await storedSessionInvalidationTask;
}
