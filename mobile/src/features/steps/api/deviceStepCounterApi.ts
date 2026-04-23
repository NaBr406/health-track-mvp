import {
  DEVICE_STEP_COUNTER_SOURCE,
  getCachedDeviceStepCounterState,
  markDeviceStepCounterSyncFailure,
  markDeviceStepCounterSyncSuccess,
  openDeviceStepCounterSettings as openDeviceStepCounterSettingsApp,
  readDeviceStepCounterRecords,
  refreshDeviceStepCounterState,
  requestDeviceStepCounterPermission
} from "../../../lib/deviceStepCounter";
import { request } from "../../../shared/api/client";
import { resolveIdentity, type DataIdentity } from "../../../shared/api/identity";
import type { AuthSession, StepSyncRecord } from "../../../types";

type ServerStepRecordSyncRequest = {
  records: Array<{
    recordedOn: string;
    steps: number;
    source: string;
    sourceDevice?: string | null;
    sourceTimeZone?: string | null;
    syncedAt: string;
  }>;
};

const stepSyncTasks = new Map<string, Promise<void>>();
const DEVICE_STEP_COUNTER_PENDING_SOURCE = "已启用设备计步，等待下一次采样";

function getStepSyncTaskKey(identity: DataIdentity, focusDate?: string) {
  return `${identity.scopeKey}:${focusDate ?? "today"}`;
}

function getStepRecordSourcePriority(record: Pick<StepSyncRecord, "source">) {
  if (record.source === DEVICE_STEP_COUNTER_SOURCE) {
    return 1;
  }

  return 0;
}

function shouldPreferStepRecord(candidate: StepSyncRecord, current: StepSyncRecord) {
  if (candidate.steps !== current.steps) {
    return candidate.steps > current.steps;
  }

  return getStepRecordSourcePriority(candidate) > getStepRecordSourcePriority(current);
}

function mergeStepRecords(records: StepSyncRecord[]) {
  const recordsByDate = new Map<string, StepSyncRecord>();

  records.forEach((record) => {
    const current = recordsByDate.get(record.recordedOn);
    if (!current || shouldPreferStepRecord(record, current)) {
      recordsByDate.set(record.recordedOn, record);
    }
  });

  return [...recordsByDate.values()].sort((left, right) => left.recordedOn.localeCompare(right.recordedOn));
}

async function syncStepRecordsToServer(identity: DataIdentity, records: ServerStepRecordSyncRequest["records"]) {
  if (!identity.session || records.length === 0) {
    return;
  }

  await request("/api/records/steps/sync", {
    method: "POST",
    body: JSON.stringify({
      records
    } satisfies ServerStepRecordSyncRequest)
  });
}

export async function getMergedLocalStepRecords(session?: AuthSession | null, focusDate?: string) {
  const deviceStepCounter = await readDeviceStepCounterRecords(session, { endDate: focusDate, days: 7 });
  return mergeStepRecords(deviceStepCounter.state.status === "ready" ? deviceStepCounter.records : []);
}

export function resolveDisplayStepSource(record: Pick<StepSyncRecord, "source" | "steps">) {
  if (record.source === DEVICE_STEP_COUNTER_SOURCE && record.steps <= 0) {
    return DEVICE_STEP_COUNTER_PENDING_SOURCE;
  }

  return record.source;
}

export async function syncStepSourcesForIdentity(identity: DataIdentity, focusDate?: string) {
  const taskKey = getStepSyncTaskKey(identity, focusDate);
  const existingTask = stepSyncTasks.get(taskKey);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    const deviceStepCounterOutcome = await readDeviceStepCounterRecords(identity.session, { endDate: focusDate, days: 7 })
      .then((result) => ({ result, error: null as unknown }))
      .catch((error) => ({ result: null, error }));

    if (deviceStepCounterOutcome.error) {
      await markDeviceStepCounterSyncFailure(identity.session, deviceStepCounterOutcome.error);
    }

    const deviceStepCounterRecords =
      deviceStepCounterOutcome.result?.state.status === "ready" ? deviceStepCounterOutcome.result.records : [];
    const mergedRecords = mergeStepRecords(deviceStepCounterRecords);

    if (!identity.session || mergedRecords.length === 0) {
      return;
    }

    try {
      await syncStepRecordsToServer(identity, mergedRecords);
    } catch (error) {
      if (deviceStepCounterRecords.length > 0) {
        await markDeviceStepCounterSyncFailure(identity.session, error);
      }
      throw error;
    }

    const syncedDays = mergedRecords.filter((record) => record.source === DEVICE_STEP_COUNTER_SOURCE).length;
    if (!deviceStepCounterOutcome.error && syncedDays > 0) {
      await markDeviceStepCounterSyncSuccess(identity.session, syncedDays);
    }
  })().finally(() => {
    stepSyncTasks.delete(taskKey);
  });

  stepSyncTasks.set(taskKey, task);
  await task;
}

async function getDeviceStepCounterSyncStatus(sessionOverride?: AuthSession | null) {
  const identity = await resolveIdentity(sessionOverride);
  return refreshDeviceStepCounterState(identity.session);
}

async function connectDeviceStepCounter(sessionOverride?: AuthSession | null, focusDate?: string) {
  const identity = await resolveIdentity(sessionOverride);
  const state = await requestDeviceStepCounterPermission(identity.session);

  if (state.status === "ready") {
    await syncStepSourcesForIdentity(identity, focusDate);
  }

  return refreshDeviceStepCounterState(identity.session);
}

async function syncDeviceStepCounter(sessionOverride?: AuthSession | null, focusDate?: string) {
  const identity = await resolveIdentity(sessionOverride);
  await syncStepSourcesForIdentity(identity, focusDate);
  return (await getCachedDeviceStepCounterState(identity.session)) ?? refreshDeviceStepCounterState(identity.session);
}

async function syncStepSources(sessionOverride?: AuthSession | null, focusDate?: string) {
  const identity = await resolveIdentity(sessionOverride);
  await syncStepSourcesForIdentity(identity, focusDate);
}

async function syncLiveDeviceStepCounterRecord(record: StepSyncRecord, sessionOverride?: AuthSession | null) {
  const identity = await resolveIdentity(sessionOverride);
  if (!identity.session) {
    return;
  }

  try {
    await syncStepRecordsToServer(identity, [record]);
    await markDeviceStepCounterSyncSuccess(identity.session, 1);
  } catch (error) {
    await markDeviceStepCounterSyncFailure(identity.session, error);
    throw error;
  }
}

function openDeviceStepCounterSettings() {
  openDeviceStepCounterSettingsApp();
}

export const deviceStepCounterApi = {
  connectDeviceStepCounter,
  getDeviceStepCounterSyncStatus,
  openDeviceStepCounterSettings,
  syncDeviceStepCounter,
  syncLiveDeviceStepCounterRecord,
  syncStepSources
};
