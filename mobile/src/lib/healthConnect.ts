import { Platform } from "react-native";
import type { AuthSession, HealthConnectSdkStatus, HealthConnectSyncState, StepSyncRecord } from "../types";
import { loadHealthConnectCache, saveHealthConnectCache } from "./healthConnectStorage";
import { getShiftedDateString, getTodayString } from "./utils";

type HealthConnectModule = typeof import("react-native-health-connect");

type ReadStepOptions = {
  days?: number;
  endDate?: string;
};

const HEALTH_CONNECT_PROVIDER_PACKAGES = [
  "com.google.android.healthconnect.controller",
  "com.google.android.apps.healthdata"
] as const;
export const HEALTH_CONNECT_STEP_SOURCE = "Health Connect sync";

function getHealthConnectModule(): HealthConnectModule | null {
  if (Platform.OS !== "android") {
    return null;
  }

  try {
    return require("react-native-health-connect") as HealthConnectModule;
  } catch {
    return null;
  }
}

function createState(
  overrides: Partial<HealthConnectSyncState> = {},
  previous?: HealthConnectSyncState | null
): HealthConnectSyncState {
  return {
    status: previous?.status ?? "unsupported",
    sdkStatus: previous?.sdkStatus ?? "unavailable",
    permissionsGranted: previous?.permissionsGranted ?? false,
    lastCheckedAt: new Date().toISOString(),
    lastReadAt: previous?.lastReadAt ?? null,
    lastSyncedAt: previous?.lastSyncedAt ?? null,
    lastError: previous?.lastError ?? null,
    syncedDays: previous?.syncedDays ?? null,
    sourceTimeZone: previous?.sourceTimeZone ?? resolveTimeZone(),
    ...overrides
  };
}

function resolveSdkStatus(module: HealthConnectModule, sdkStatus: number): HealthConnectSdkStatus {
  if (sdkStatus === module.SdkAvailabilityStatus.SDK_AVAILABLE) {
    return "available";
  }
  if (sdkStatus === module.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return "update_required";
  }
  return "unavailable";
}

function resolveProviderPackages() {
  const version = typeof Platform.Version === "number"
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10);

  if (Number.isFinite(version) && version < 34) {
    return [...HEALTH_CONNECT_PROVIDER_PACKAGES].reverse();
  }

  return [...HEALTH_CONNECT_PROVIDER_PACKAGES];
}

async function resolveProviderStatus(module: HealthConnectModule) {
  const packages = resolveProviderPackages();
  let updateRequiredPackage: string | null = null;

  for (const providerPackageName of packages) {
    const sdkStatus = resolveSdkStatus(module, await module.getSdkStatus(providerPackageName));
    if (sdkStatus === "available") {
      return {
        providerPackageName,
        sdkStatus
      } as const;
    }
    if (sdkStatus === "update_required" && !updateRequiredPackage) {
      updateRequiredPackage = providerPackageName;
    }
  }

  return {
    providerPackageName: updateRequiredPackage ?? packages[0],
    sdkStatus: updateRequiredPackage ? "update_required" : "unavailable"
  } as const;
}

function hasStepsPermission(grantedPermissions: Array<{ accessType: string; recordType: string }>) {
  return grantedPermissions.some((permission) => permission.accessType === "read" && permission.recordType === "Steps");
}

function resolveTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function resolveDeviceName() {
  if (!Platform.constants || typeof Platform.constants !== "object") {
    return null;
  }

  const candidate = (Platform.constants as Record<string, unknown>).Model;
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
}

function getDateRange(endDate = getTodayString(), days = 7) {
  return Array.from({ length: days }, (_, index) => getShiftedDateString(endDate, index - (days - 1)));
}

function getLocalDayBounds(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Health Connect request failed.";
}

async function saveCacheState(
  state: HealthConnectSyncState,
  session?: AuthSession | null,
  records?: StepSyncRecord[]
) {
  const cache = await loadHealthConnectCache(session);
  await saveHealthConnectCache(
    {
      state,
      records: records ?? cache.records
    },
    session
  );

  return state;
}

export async function getCachedHealthConnectState(session?: AuthSession | null) {
  return (await loadHealthConnectCache(session)).state;
}

export async function refreshHealthConnectState(session?: AuthSession | null) {
  const cache = await loadHealthConnectCache(session);
  const module = getHealthConnectModule();

  if (!module) {
    const state = createState(
      {
        status: "unsupported",
        sdkStatus: "unavailable",
        permissionsGranted: false
      },
      cache.state
    );
    return saveCacheState(state, session, cache.records);
  }

  try {
    const providerStatus = await resolveProviderStatus(module);
    const sdkStatus = providerStatus.sdkStatus;

    if (sdkStatus !== "available") {
      const state = createState(
        {
          status: sdkStatus === "update_required" ? "update_required" : "unavailable",
          sdkStatus,
          permissionsGranted: false
        },
        cache.state
      );
      return saveCacheState(state, session, cache.records);
    }

    const initialized = await module.initialize(providerStatus.providerPackageName);
    if (!initialized) {
      const state = createState(
        {
          status: "error",
          sdkStatus,
          permissionsGranted: false,
          lastError: "Health Connect initialization failed."
        },
        cache.state
      );
      return saveCacheState(state, session, cache.records);
    }

    const grantedPermissions = await module.getGrantedPermissions();
    const ready = hasStepsPermission(grantedPermissions);
    const state = createState(
      {
        status: ready ? "ready" : "needs_permission",
        sdkStatus,
        permissionsGranted: ready,
        lastError: ready ? null : cache.state?.lastError ?? null
      },
      cache.state
    );

    return saveCacheState(state, session, cache.records);
  } catch (error) {
    const state = createState(
      {
        status: "error",
        sdkStatus: cache.state?.sdkStatus ?? "unavailable",
        permissionsGranted: cache.state?.permissionsGranted ?? false,
        lastError: getErrorMessage(error)
      },
      cache.state
    );
    return saveCacheState(state, session, cache.records);
  }
}

export async function requestHealthConnectPermission(session?: AuthSession | null) {
  const state = await refreshHealthConnectState(session);
  if (state.status === "unsupported" || state.status === "unavailable" || state.status === "update_required") {
    return state;
  }

  const module = getHealthConnectModule();
  if (!module) {
    return state;
  }

  try {
    await module.requestPermission([
      {
        accessType: "read",
        recordType: "Steps"
      }
    ]);
  } catch (error) {
    const failedState = createState(
      {
        status: "error",
        sdkStatus: state.sdkStatus,
        permissionsGranted: false,
        lastError: getErrorMessage(error)
      },
      state
    );
    return saveCacheState(failedState, session);
  }

  return refreshHealthConnectState(session);
}

export async function readHealthConnectStepRecords(session?: AuthSession | null, options: ReadStepOptions = {}) {
  const cache = await loadHealthConnectCache(session);
  const state = await refreshHealthConnectState(session);

  if (state.status !== "ready") {
    return {
      state,
      records: cache.records
    };
  }

  const module = getHealthConnectModule();
  if (!module) {
    return {
      state,
      records: cache.records
    };
  }

  const days = options.days ?? 7;
  const endDate = options.endDate ?? getTodayString();
  const timeZone = resolveTimeZone();
  const deviceName = resolveDeviceName();
  const syncedAt = new Date().toISOString();

  try {
    const records = await Promise.all(
      getDateRange(endDate, days).map(async (recordedOn) => {
        const { start, end } = getLocalDayBounds(recordedOn);
        const result = await module.aggregateRecord({
          recordType: "Steps",
          timeRangeFilter: {
            operator: "between",
            startTime: start.toISOString(),
            endTime: end.toISOString()
          }
        });

        return {
          recordedOn,
          steps: typeof result.COUNT_TOTAL === "number" ? result.COUNT_TOTAL : 0,
          source: HEALTH_CONNECT_STEP_SOURCE,
          sourceDevice: deviceName,
          sourceTimeZone: timeZone,
          syncedAt
        } satisfies StepSyncRecord;
      })
    );

    const nextState = createState(
      {
        status: "ready",
        sdkStatus: "available",
        permissionsGranted: true,
        lastReadAt: syncedAt,
        lastError: null,
        syncedDays: records.length,
        sourceTimeZone: timeZone
      },
      state
    );

    await saveHealthConnectCache(
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
        sdkStatus: "available",
        permissionsGranted: true,
        lastError: getErrorMessage(error)
      },
      state
    );

    await saveHealthConnectCache(
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

export async function markHealthConnectSyncSuccess(session: AuthSession | null | undefined, syncedDays: number) {
  const cache = await loadHealthConnectCache(session);
  const state = createState(
    {
      status: cache.state?.permissionsGranted ? "ready" : cache.state?.status ?? "needs_permission",
      sdkStatus: cache.state?.sdkStatus ?? "available",
      permissionsGranted: cache.state?.permissionsGranted ?? false,
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      syncedDays
    },
    cache.state
  );

  return saveCacheState(state, session, cache.records);
}

export async function markHealthConnectSyncFailure(session: AuthSession | null | undefined, error: unknown) {
  const cache = await loadHealthConnectCache(session);
  const state = createState(
    {
      status: cache.state?.permissionsGranted ? "ready" : cache.state?.status ?? "error",
      sdkStatus: cache.state?.sdkStatus ?? "available",
      permissionsGranted: cache.state?.permissionsGranted ?? false,
      lastError: getErrorMessage(error)
    },
    cache.state
  );

  return saveCacheState(state, session, cache.records);
}

export function openHealthConnectSettings() {
  const module = getHealthConnectModule();
  if (module) {
    module.openHealthConnectSettings();
  }
}

export function openHealthConnectDataManagement() {
  const module = getHealthConnectModule();
  if (module) {
    module.openHealthConnectDataManagement();
  }
}
