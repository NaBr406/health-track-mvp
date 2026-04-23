import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession, DeviceStepCounterSyncState, StepSyncRecord } from "../types";
import { getDataScopeKey } from "./dataScope";

type DeviceStepCounterCache = {
  state: DeviceStepCounterSyncState | null;
  records: StepSyncRecord[];
};

const DEVICE_STEP_COUNTER_CACHE_KEY_PREFIX = "health-track-mobile-device-step-counter";

function getDeviceStepCounterCacheKey(session?: AuthSession | null) {
  return `${DEVICE_STEP_COUNTER_CACHE_KEY_PREFIX}:${getDataScopeKey(session)}`;
}

function normalizeCache(value: unknown): DeviceStepCounterCache {
  if (!value || typeof value !== "object") {
    return {
      state: null,
      records: []
    };
  }

  const parsed = value as Partial<DeviceStepCounterCache>;
  return {
    state: parsed.state ?? null,
    records: Array.isArray(parsed.records) ? parsed.records : []
  };
}

export async function loadDeviceStepCounterCache(session?: AuthSession | null) {
  const raw = await AsyncStorage.getItem(getDeviceStepCounterCacheKey(session));

  if (!raw) {
    return {
      state: null,
      records: []
    } satisfies DeviceStepCounterCache;
  }

  try {
    return normalizeCache(JSON.parse(raw));
  } catch {
    return {
      state: null,
      records: []
    } satisfies DeviceStepCounterCache;
  }
}

export async function saveDeviceStepCounterCache(cache: DeviceStepCounterCache, session?: AuthSession | null) {
  await AsyncStorage.setItem(getDeviceStepCounterCacheKey(session), JSON.stringify(cache));
}
