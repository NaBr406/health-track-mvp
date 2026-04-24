import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AdjustmentFeedback, ChatMessage, HealthProfile, MonitoringHistoryPoint } from "../../types";

export type FallbackStore = {
  profile: HealthProfile | null;
  historyStore: MonitoringHistoryPoint[];
  messagesByDate: Record<string, ChatMessage[]>;
  feedbackByDate: Record<string, AdjustmentFeedback>;
};

const FALLBACK_STORE_KEY_PREFIX = "health-track-mobile-fallback-store";

function getFallbackStoreKey(scopeKey: string) {
  return `${FALLBACK_STORE_KEY_PREFIX}:${scopeKey}`;
}

function createEmptyPoint(date: string): MonitoringHistoryPoint {
  return {
    date,
    calories: 0,
    exerciseMinutes: 0,
    steps: 0,
    sleepHours: 0,
    glucoseMmol: null,
    glucoseSource: null
  };
}

function createEmptyStore(): FallbackStore {
  return {
    profile: null,
    historyStore: [],
    messagesByDate: {},
    feedbackByDate: {}
  };
}

export function clonePoint(point: MonitoringHistoryPoint): MonitoringHistoryPoint {
  return {
    ...point,
    glucoseMmol: typeof point.glucoseMmol === "number" ? point.glucoseMmol : null,
    glucoseSource: point.glucoseSource ?? null
  };
}

export function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message
  };
}

export function cloneProfile(profile: HealthProfile | null) {
  return profile ? { ...profile } : null;
}

function normalizeStore(value: unknown): FallbackStore {
  if (!value || typeof value !== "object") {
    return createEmptyStore();
  }

  // 本地兜底数据按不可信输入处理，避免旧版本结构影响新页面渲染。
  const parsed = value as Partial<FallbackStore>;
  const historyStore = Array.isArray(parsed.historyStore) ? parsed.historyStore.map(clonePoint) : [];
  const messagesByDate = Object.fromEntries(
    Object.entries(parsed.messagesByDate ?? {}).map(([date, messages]) => [
      date,
      Array.isArray(messages) ? messages.map(cloneMessage) : []
    ])
  );
  const feedbackByDate = Object.fromEntries(
    Object.entries(parsed.feedbackByDate ?? {}).filter(([, feedback]) => feedback === "accept" || feedback === "reject" || feedback === null)
  ) as Record<string, AdjustmentFeedback>;

  return {
    profile: cloneProfile(parsed.profile ?? null),
    historyStore,
    messagesByDate,
    feedbackByDate
  };
}

export async function loadStore(scopeKey: string) {
  const raw = await AsyncStorage.getItem(getFallbackStoreKey(scopeKey));

  if (!raw) {
    return createEmptyStore();
  }

  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    return createEmptyStore();
  }
}

async function saveStore(scopeKey: string, store: FallbackStore) {
  await AsyncStorage.setItem(getFallbackStoreKey(scopeKey), JSON.stringify(store));
}

export async function updateStore<T>(scopeKey: string, updater: (store: FallbackStore) => T) {
  const store = await loadStore(scopeKey);
  const result = updater(store);
  await saveStore(scopeKey, store);
  return result;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getStoredPoint(store: FallbackStore, date: string) {
  return store.historyStore.find((item) => item.date === date);
}

export function getPointForRead(store: FallbackStore, date: string) {
  return clonePoint(getStoredPoint(store, date) ?? createEmptyPoint(date));
}

export function ensureMutablePoint(store: FallbackStore, date: string) {
  const existing = getStoredPoint(store, date);

  if (existing) {
    return existing;
  }

  const created = createEmptyPoint(date);
  store.historyStore = [...store.historyStore, created].sort((left, right) => left.date.localeCompare(right.date));
  return created;
}

export function hasGlucoseValue(point: MonitoringHistoryPoint) {
  return typeof point.glucoseMmol === "number" && Number.isFinite(point.glucoseMmol);
}
