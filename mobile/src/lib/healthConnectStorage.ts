import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession, HealthConnectSyncState, StepSyncRecord } from "../types";
import { getDataScopeKey } from "./dataScope";

type HealthConnectCache = {
  state: HealthConnectSyncState | null;
  records: StepSyncRecord[];
};

const HEALTH_CONNECT_CACHE_KEY_PREFIX = "health-track-mobile-health-connect";

function getHealthConnectCacheKey(session?: AuthSession | null) {
  return `${HEALTH_CONNECT_CACHE_KEY_PREFIX}:${getDataScopeKey(session)}`;
}

function normalizeCache(value: unknown): HealthConnectCache {
  if (!value || typeof value !== "object") {
    return {
      state: null,
      records: []
    };
  }

  const parsed = value as Partial<HealthConnectCache>;
  return {
    state: parsed.state ?? null,
    records: Array.isArray(parsed.records) ? parsed.records : []
  };
}

export async function loadHealthConnectCache(session?: AuthSession | null) {
  const raw = await AsyncStorage.getItem(getHealthConnectCacheKey(session));

  if (!raw) {
    return {
      state: null,
      records: []
    } satisfies HealthConnectCache;
  }

  try {
    return normalizeCache(JSON.parse(raw));
  } catch {
    return {
      state: null,
      records: []
    } satisfies HealthConnectCache;
  }
}

export async function saveHealthConnectCache(cache: HealthConnectCache, session?: AuthSession | null) {
  await AsyncStorage.setItem(getHealthConnectCacheKey(session), JSON.stringify(cache));
}
