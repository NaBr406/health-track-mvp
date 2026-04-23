import { Linking, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from "react-native";
import type { AuthSession, DeviceStepCounterSyncState, StepSyncRecord } from "../types";
import { loadDeviceStepCounterCache, saveDeviceStepCounterCache } from "./deviceStepCounterStorage";
import { getTodayString } from "./utils";

type NativeDeviceStepCounterModule = {
  getStatus(): Promise<{
    sensorAvailable: boolean;
    permissionGranted: boolean;
    backgroundSamplingEnabled: boolean;
    lastSnapshotAt?: string | null;
    lastReadAt?: string | null;
    lastError?: string | null;
    sourceDevice?: string | null;
    samplingIntervalMinutes?: number | null;
  }>;
  readDailyRecords(days: number, endDate?: string | null): Promise<
    Array<{
      recordedOn: string;
      steps: number;
      sampledAt?: string | null;
    }>
  >;
  startLiveUpdates(): Promise<boolean>;
  stopLiveUpdates(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

type ReadStepOptions = {
  days?: number;
  endDate?: string;
};

type DeviceStepCounterLiveUpdatePayload = {
  recordedOn?: string | null;
  steps?: number | null;
  sampledAt?: string | null;
  sourceDevice?: string | null;
  sourceTimeZone?: string | null;
};

const ACTIVITY_RECOGNITION_PERMISSION =
  PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION ?? "android.permission.ACTIVITY_RECOGNITION";
const DEVICE_STEP_COUNTER_LIVE_UPDATE_EVENT = "deviceStepCounterLiveUpdate";

export const DEVICE_STEP_COUNTER_SOURCE = "设备传感器";

function getDeviceStepCounterModule(): NativeDeviceStepCounterModule | null {
  if (Platform.OS !== "android") {
    return null;
  }

  const candidate = NativeModules.DeviceStepCounter;
  return candidate ? (candidate as NativeDeviceStepCounterModule) : null;
}

function getDeviceStepCounterEmitter(module: NativeDeviceStepCounterModule) {
  return new NativeEventEmitter(module as never);
}

function resolveTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function createState(
  overrides: Partial<DeviceStepCounterSyncState> = {},
  previous?: DeviceStepCounterSyncState | null
): DeviceStepCounterSyncState {
  return {
    status: previous?.status ?? "unsupported",
    sensorAvailable: previous?.sensorAvailable ?? false,
    permissionsGranted: previous?.permissionsGranted ?? false,
    backgroundSamplingEnabled: previous?.backgroundSamplingEnabled ?? false,
    lastCheckedAt: new Date().toISOString(),
    lastReadAt: previous?.lastReadAt ?? null,
    lastSampledAt: previous?.lastSampledAt ?? null,
    lastSyncedAt: previous?.lastSyncedAt ?? null,
    lastError: previous?.lastError ?? null,
    syncedDays: previous?.syncedDays ?? null,
    sourceTimeZone: previous?.sourceTimeZone ?? resolveTimeZone(),
    sourceDevice: previous?.sourceDevice ?? null,
    samplingIntervalMinutes: previous?.samplingIntervalMinutes ?? 15,
    ...overrides
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Device step counter request failed.";
}

function normalizeLiveUpdateRecord(payload: DeviceStepCounterLiveUpdatePayload): StepSyncRecord | null {
  const recordedOn = typeof payload.recordedOn === "string" && payload.recordedOn.trim() ? payload.recordedOn : getTodayString();
  const parsedSteps = typeof payload.steps === "number" ? payload.steps : Number(payload.steps);
  if (!Number.isFinite(parsedSteps)) {
    return null;
  }

  const sampledAt = typeof payload.sampledAt === "string" && payload.sampledAt.trim() ? payload.sampledAt : new Date().toISOString();

  return {
    recordedOn,
    steps: Math.max(0, Math.trunc(parsedSteps)),
    source: DEVICE_STEP_COUNTER_SOURCE,
    sourceDevice: payload.sourceDevice ?? null,
    sourceTimeZone: payload.sourceTimeZone ?? resolveTimeZone(),
    syncedAt: sampledAt
  };
}

async function saveCacheState(
  state: DeviceStepCounterSyncState,
  session?: AuthSession | null,
  records?: StepSyncRecord[]
) {
  const cache = await loadDeviceStepCounterCache(session);
  await saveDeviceStepCounterCache(
    {
      state,
      records: records ?? cache.records
    },
    session
  );

  return state;
}

export async function getCachedDeviceStepCounterState(session?: AuthSession | null) {
  return (await loadDeviceStepCounterCache(session)).state;
}

export async function refreshDeviceStepCounterState(session?: AuthSession | null) {
  const cache = await loadDeviceStepCounterCache(session);
  const module = getDeviceStepCounterModule();

  if (!module) {
    const state = createState(
      {
        status: "unsupported",
        sensorAvailable: false,
        permissionsGranted: false,
        backgroundSamplingEnabled: false
      },
      cache.state
    );
    return saveCacheState(state, session, cache.records);
  }

  try {
    const nativeStatus = await module.getStatus();
    const nextStatus = !nativeStatus.sensorAvailable
      ? "unsupported"
      : nativeStatus.permissionGranted
        ? "ready"
        : "needs_permission";

    const state = createState(
      {
        status: nextStatus,
        sensorAvailable: nativeStatus.sensorAvailable,
        permissionsGranted: nativeStatus.permissionGranted,
        backgroundSamplingEnabled: nativeStatus.backgroundSamplingEnabled,
        lastReadAt: nativeStatus.lastReadAt ?? cache.state?.lastReadAt ?? null,
        lastSampledAt: nativeStatus.lastSnapshotAt ?? cache.state?.lastSampledAt ?? null,
        lastError: nativeStatus.lastError ?? cache.state?.lastError ?? null,
        sourceDevice: nativeStatus.sourceDevice ?? cache.state?.sourceDevice ?? null,
        sourceTimeZone: cache.state?.sourceTimeZone ?? resolveTimeZone(),
        samplingIntervalMinutes: nativeStatus.samplingIntervalMinutes ?? cache.state?.samplingIntervalMinutes ?? 15
      },
      cache.state
    );

    return saveCacheState(state, session, cache.records);
  } catch (error) {
    const state = createState(
      {
        status: "error",
        sensorAvailable: cache.state?.sensorAvailable ?? false,
        permissionsGranted: cache.state?.permissionsGranted ?? false,
        backgroundSamplingEnabled: cache.state?.backgroundSamplingEnabled ?? false,
        lastError: getErrorMessage(error)
      },
      cache.state
    );
    return saveCacheState(state, session, cache.records);
  }
}

export async function requestDeviceStepCounterPermission(session?: AuthSession | null) {
  const state = await refreshDeviceStepCounterState(session);
  if (state.status === "unsupported") {
    return state;
  }

  if (Platform.OS !== "android") {
    return state;
  }

  if (typeof Platform.Version === "number" && Platform.Version < 29) {
    return refreshDeviceStepCounterState(session);
  }

  const result = await PermissionsAndroid.request(ACTIVITY_RECOGNITION_PERMISSION, {
    title: "启用设备计步",
    message: "允许访问活动识别权限后，App 才能通过设备传感器读取步数。",
    buttonPositive: "允许",
    buttonNegative: "暂不"
  });

  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    const deniedState = createState(
      {
        status: "needs_permission",
        lastError: result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? "活动识别权限已被系统禁止。" : null
      },
      state
    );
    return saveCacheState(deniedState, session);
  }

  return refreshDeviceStepCounterState(session);
}

export async function readDeviceStepCounterRecords(session?: AuthSession | null, options: ReadStepOptions = {}) {
  const cache = await loadDeviceStepCounterCache(session);
  const state = await refreshDeviceStepCounterState(session);

  if (state.status !== "ready") {
    return {
      state,
      records: cache.records
    };
  }

  const module = getDeviceStepCounterModule();
  if (!module) {
    return {
      state,
      records: cache.records
    };
  }

  const days = options.days ?? 7;
  const endDate = options.endDate ?? getTodayString();
  const timeZone = resolveTimeZone();
  const syncedAt = new Date().toISOString();

  try {
    const rawRecords = await module.readDailyRecords(days, endDate);
    const records = rawRecords.map((record) => ({
      recordedOn: record.recordedOn,
      steps: Math.max(0, Math.trunc(record.steps)),
      source: DEVICE_STEP_COUNTER_SOURCE,
      sourceDevice: state.sourceDevice ?? null,
      sourceTimeZone: timeZone,
      syncedAt
    } satisfies StepSyncRecord));

    const nextState = createState(
      {
        status: "ready",
        sensorAvailable: true,
        permissionsGranted: true,
        backgroundSamplingEnabled: state.backgroundSamplingEnabled,
        lastReadAt: syncedAt,
        lastSampledAt:
          rawRecords
            .map((record) => record.sampledAt ?? null)
            .filter((value): value is string => Boolean(value))
            .sort((left, right) => right.localeCompare(left))[0] ?? state.lastSampledAt ?? null,
        lastError: null,
        syncedDays: records.length,
        sourceTimeZone: timeZone
      },
      state
    );

    await saveDeviceStepCounterCache(
      {
        state: nextState,
        records
      },
      session
    );

    return {
      state: nextState,
      records
    };
  } catch (error) {
    const failedState = createState(
      {
        status: "error",
        sensorAvailable: state.sensorAvailable,
        permissionsGranted: state.permissionsGranted,
        backgroundSamplingEnabled: state.backgroundSamplingEnabled,
        lastError: getErrorMessage(error)
      },
      state
    );

    await saveDeviceStepCounterCache(
      {
        state: failedState,
        records: cache.records
      },
      session
    );

    return {
      state: failedState,
      records: cache.records
    };
  }
}

export async function markDeviceStepCounterSyncSuccess(session: AuthSession | null | undefined, syncedDays: number) {
  const cache = await loadDeviceStepCounterCache(session);
  const state = createState(
    {
      status: cache.state?.permissionsGranted ? "ready" : cache.state?.status ?? "needs_permission",
      sensorAvailable: cache.state?.sensorAvailable ?? false,
      permissionsGranted: cache.state?.permissionsGranted ?? false,
      backgroundSamplingEnabled: cache.state?.backgroundSamplingEnabled ?? false,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      syncedDays
    },
    cache.state
  );

  return saveCacheState(state, session, cache.records);
}

export async function markDeviceStepCounterSyncFailure(session: AuthSession | null | undefined, error: unknown) {
  const cache = await loadDeviceStepCounterCache(session);
  const state = createState(
    {
      status: cache.state?.permissionsGranted ? "ready" : cache.state?.status ?? "error",
      sensorAvailable: cache.state?.sensorAvailable ?? false,
      permissionsGranted: cache.state?.permissionsGranted ?? false,
      backgroundSamplingEnabled: cache.state?.backgroundSamplingEnabled ?? false,
      lastError: getErrorMessage(error)
    },
    cache.state
  );

  return saveCacheState(state, session, cache.records);
}

export function subscribeDeviceStepCounterLiveUpdates(
  session: AuthSession | null | undefined,
  onUpdate: (record: StepSyncRecord) => void,
  onError?: (error: unknown) => void
) {
  const module = getDeviceStepCounterModule();
  if (!module) {
    return () => undefined;
  }

  const emitter = getDeviceStepCounterEmitter(module);
  let active = true;
  const subscription = emitter.addListener(DEVICE_STEP_COUNTER_LIVE_UPDATE_EVENT, (payload: DeviceStepCounterLiveUpdatePayload) => {
    const record = normalizeLiveUpdateRecord(payload);
    if (!active || !record) {
      return;
    }

    onUpdate(record);
  });

  void module.startLiveUpdates().catch((error) => {
    subscription.remove();
    if (active) {
      onError?.(error);
    }
  });

  return () => {
    active = false;
    subscription.remove();
    void module.stopLiveUpdates();
  };
}

export function openDeviceStepCounterSettings() {
  void Linking.openSettings();
}
