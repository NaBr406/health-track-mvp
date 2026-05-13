/**
 * 本地保存和清理登录会话的小型工具。
 */
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "../types";

const TOKEN_KEY = "health-track-mobile-token";
const SESSION_KEY = "health-track-mobile-session";
type StoredSessionInvalidationListener = () => void | Promise<void>;

let storedSessionInvalidationListener: StoredSessionInvalidationListener | null = null;
let storedSessionInvalidationTask: Promise<void> | null = null;

export async function saveStoredSession(session: AuthSession) {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadStoredSession() {
  let raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    // migrate from AsyncStorage
    raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(SESSION_KEY, raw);
      await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
    }
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function loadToken() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) return token;
  // migrate from AsyncStorage
  const legacy = await AsyncStorage.getItem(TOKEN_KEY);
  if (legacy) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacy);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
  return legacy;
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_KEY);
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
