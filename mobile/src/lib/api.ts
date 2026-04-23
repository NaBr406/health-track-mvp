/**
 * 移动端数据网关。
 *
 * 这个文件把“请求服务端”和“回退到本地作用域数据”统一封在一起，
 * 目的是让上层页面只关心业务数据，不需要反复判断：
 * 1. 当前是游客模式还是登录模式。
 * 2. 服务端是否可用。
 * 3. 本地缓存是否需要拿来做补偿或恢复。
 */
import { invalidateStoredSession, loadToken } from "./auth";
import { getDataScopeKey, loadDataScope } from "./dataScope";
import {
  DEVICE_STEP_COUNTER_SOURCE,
  getCachedDeviceStepCounterState,
  markDeviceStepCounterSyncFailure,
  markDeviceStepCounterSyncSuccess,
  openDeviceStepCounterSettings as openDeviceStepCounterSettingsApp,
  readDeviceStepCounterRecords,
  refreshDeviceStepCounterState,
  requestDeviceStepCounterPermission
} from "./deviceStepCounter";
import { loadStoredHealthProfile, saveStoredHealthProfile } from "./healthProfileStorage";
import {
  getFallbackChatThread,
  getFallbackDashboardSnapshot,
  getFallbackHealthProfile,
  getFallbackRecordedGlucosePoints,
  saveFallbackHealthProfile,
  sendFallbackChatMessage,
  submitFallbackDashboardFeedback
} from "./mockStore";
import type {
  AuthSession,
  ChatThread,
  ChatSendPayload,
  ChatSendResult,
  DashboardFeedbackPayload,
  DashboardSnapshot,
  HealthProfile,
  StepSyncRecord
} from "../types";

const RELEASE_API_BASE_URL = "http://150.158.117.174";
const API_BASE_URL = __DEV__ ? process.env.EXPO_PUBLIC_API_BASE_URL || RELEASE_API_BASE_URL : RELEASE_API_BASE_URL;

export class AuthExpiredError extends Error {
  constructor(message = "Session expired. Please sign in again.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

export function isAuthExpiredError(error: unknown): error is AuthExpiredError {
  return error instanceof AuthExpiredError || (error instanceof Error && error.name === "AuthExpiredError");
}

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  nickname?: string;
};

type ServerProfileResponse = {
  email?: string | null;
  nickname?: string | null;
  avatarPresetId?: string | null;
  avatarUri?: string | null;
  conditionLabel?: string | null;
  fastingGlucoseBaseline?: string | null;
  bloodPressureBaseline?: string | null;
  restingHeartRate?: number | null;
  medicationPlan?: string | null;
  notes?: string | null;
  age?: number | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  careFocus?: string | null;
  healthGoal?: string | null;
  updatedAt?: string | null;
};

type ServerCareRecordResponse = {
  recordedOn: string;
  glucoseMmol?: number | null;
};

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

type DataIdentity = {
  session: AuthSession | null;
  scopeKey: string;
};

const glucoseRecoveryTasks = new Map<string, Promise<void>>();
const stepSyncTasks = new Map<string, Promise<void>>();
const DEVICE_STEP_COUNTER_PENDING_SOURCE = "已启用设备计步，等待下一次采样";

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value?: string | null) {
  return hasText(value) ? value.trim() : null;
}

async function request<T>(path: string, init: RequestInit = {}, fallback?: T | (() => T | Promise<T>)): Promise<T> {
  /**
   * 统一请求入口。
   *
   * 约定：
   * 1. 自动附带 token。
   * 2. 请求失败时，如果调用方提供了 fallback，则静默走兜底。
   * 3. 204 响应也允许映射成 fallback，避免上层为“空响应”写重复判断。
   */
  const resolveFallback = async () => {
    if (typeof fallback === "function") {
      return (fallback as () => T | Promise<T>)();
    }

    return fallback as T;
  };

  try {
    // 所有请求都经过这里，便于统一附带鉴权头并保持离线兜底行为一致。
    const token = await loadToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(buildUrl(path), {
      ...init,
      headers
    });

    if (response.status === 401 || response.status === 403) {
      await invalidateStoredSession();
      throw new AuthExpiredError();
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (response.status === 204) {
      return (await resolveFallback()) as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (isAuthExpiredError(error)) {
      throw error;
    }

    if (fallback !== undefined) {
      return (await resolveFallback()) as T;
    }

    throw error;
  }
}

async function resolveIdentity(sessionOverride?: AuthSession | null): Promise<DataIdentity> {
  if (sessionOverride !== undefined) {
    return {
      session: sessionOverride,
      scopeKey: getDataScopeKey(sessionOverride)
    };
  }

  return loadDataScope();
}

function mergeServerProfile(remote: ServerProfileResponse, stored: HealthProfile | null, session: AuthSession | null): HealthProfile {
  const now = new Date().toISOString();

  // 服务端资料优先，但会尽量保留本地补充过而服务端还没有的字段，
  // 这样能避免“本地先编辑、服务端稍后同步”时把信息覆盖掉。
  return {
    email: remote.email ?? stored?.email ?? session?.email ?? null,
    nickname: remote.nickname ?? stored?.nickname ?? session?.nickname ?? "",
    avatarPresetId: normalizeText(remote.avatarPresetId) ?? stored?.avatarPresetId ?? null,
    avatarUri: normalizeText(remote.avatarUri) ?? stored?.avatarUri ?? null,
    conditionLabel: remote.conditionLabel ?? stored?.conditionLabel ?? "",
    fastingGlucoseBaseline: remote.fastingGlucoseBaseline ?? stored?.fastingGlucoseBaseline ?? null,
    bloodPressureBaseline: remote.bloodPressureBaseline ?? stored?.bloodPressureBaseline ?? null,
    restingHeartRate: remote.restingHeartRate ?? stored?.restingHeartRate ?? null,
    medicationPlan: remote.medicationPlan ?? stored?.medicationPlan ?? null,
    notes: remote.notes ?? stored?.notes ?? null,
    age: remote.age ?? stored?.age ?? null,
    biologicalSex: remote.gender ?? stored?.biologicalSex ?? null,
    heightCm: remote.heightCm ?? stored?.heightCm ?? null,
    weightKg: remote.weightKg ?? stored?.weightKg ?? null,
    targetWeightKg: remote.targetWeightKg ?? stored?.targetWeightKg ?? null,
    careFocus: remote.careFocus ?? stored?.careFocus ?? null,
    primaryTarget: remote.healthGoal ?? stored?.primaryTarget ?? "",
    updatedAt: remote.updatedAt ?? stored?.updatedAt ?? now,
    completedAt: stored?.completedAt ?? now
  };
}

function buildServerProfilePayload(profile: HealthProfile) {
  return {
    nickname: profile.nickname.trim(),
    avatarPresetId: normalizeText(profile.avatarPresetId),
    avatarUri: normalizeText(profile.avatarUri),
    conditionLabel: profile.conditionLabel.trim(),
    fastingGlucoseBaseline: normalizeText(profile.fastingGlucoseBaseline),
    bloodPressureBaseline: normalizeText(profile.bloodPressureBaseline),
    restingHeartRate: profile.restingHeartRate ?? null,
    medicationPlan: normalizeText(profile.medicationPlan),
    notes: normalizeText(profile.notes),
    age: profile.age ?? null,
    gender: normalizeText(profile.biologicalSex),
    heightCm: profile.heightCm ?? null,
    weightKg: profile.weightKg ?? null,
    targetWeightKg: profile.targetWeightKg ?? null,
    careFocus: normalizeText(profile.careFocus),
    healthGoal: profile.primaryTarget.trim()
  };
}

function hasRecoverableStoredProfile(profile: HealthProfile | null) {
  if (!profile) {
    return false;
  }

  return Boolean(
    normalizeText(profile.avatarPresetId) ||
      normalizeText(profile.avatarUri) ||
      profile.nickname.trim() ||
      profile.conditionLabel.trim() ||
      profile.primaryTarget.trim() ||
      normalizeText(profile.fastingGlucoseBaseline) ||
      profile.weightKg != null ||
      profile.targetWeightKg != null ||
      profile.heightCm != null ||
      profile.age != null ||
      normalizeText(profile.medicationPlan) ||
      normalizeText(profile.notes)
  );
}

function isRemoteProfileEffectivelyEmpty(remote: ServerProfileResponse) {
  const meaningfulFields = [
    normalizeText(remote.conditionLabel) && normalizeText(remote.conditionLabel) !== "condition-pending",
    normalizeText(remote.healthGoal),
    normalizeText(remote.fastingGlucoseBaseline),
    normalizeText(remote.bloodPressureBaseline),
    normalizeText(remote.careFocus),
    normalizeText(remote.medicationPlan),
    remote.weightKg != null,
    remote.targetWeightKg != null,
    remote.heightCm != null,
    remote.age != null
  ];

  return meaningfulFields.filter(Boolean).length === 0;
}

function shouldRecoverServerProfile(remote: ServerProfileResponse, stored: HealthProfile | null, merged: HealthProfile) {
  if (!hasRecoverableStoredProfile(stored)) {
    return false;
  }

  const needsAvatarRecovery = Boolean(
    (normalizeText(merged.avatarPresetId) || normalizeText(merged.avatarUri)) &&
      !normalizeText(remote.avatarPresetId) &&
      !normalizeText(remote.avatarUri)
  );

  return needsAvatarRecovery || isRemoteProfileEffectivelyEmpty(remote);
}

async function persistScopedProfile(identity: DataIdentity, profile: HealthProfile) {
  // 同时维护本地和兜底存储，避免临时断网或游客/账号切换时丢失最近编辑结果。
  await Promise.all([
    saveStoredHealthProfile(profile, identity.session),
    saveFallbackHealthProfile(identity.scopeKey, profile)
  ]);

  return profile;
}

async function loadScopedProfile(identity: DataIdentity) {
  const storedProfile = await loadStoredHealthProfile(identity.session);
  if (storedProfile) {
    return storedProfile;
  }

  return getFallbackHealthProfile(identity.scopeKey);
}

async function pushProfileToServer(profile: HealthProfile) {
  return request<ServerProfileResponse>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(buildServerProfilePayload(profile))
  });
}

async function recoverServerProfile(identity: DataIdentity, remote: ServerProfileResponse, stored: HealthProfile | null) {
  // 当服务端档案明显过空，而本地缓存又存在更完整的数据时，
  // 这里会主动把合并后的档案补推回服务端，减少用户感知到的数据丢失。
  const merged = mergeServerProfile(remote, stored, identity.session);

  if (!shouldRecoverServerProfile(remote, stored, merged)) {
    return remote;
  }

  try {
    return await pushProfileToServer(merged);
  } catch {
    return remote;
  }
}

async function recoverAccountGlucoseRecords(identity: DataIdentity) {
  if (!identity.session) {
    return;
  }

  // 同一账号作用域下只允许一个补偿任务并发执行，避免重复补写同一批血糖记录。
  const existingTask = glucoseRecoveryTasks.get(identity.scopeKey);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    // 有些血糖点可能先记录在游客态，登录后这里会尽量补回到账号数据里。
    const recordedPoints = await getFallbackRecordedGlucosePoints(identity.scopeKey);

    if (recordedPoints.length === 0) {
      return;
    }

    const sortedDates = [...new Set(recordedPoints.map((point) => point.date))].sort((left, right) => left.localeCompare(right));
    const remoteRecords = await request<ServerCareRecordResponse[]>(
      `/api/records/care${buildQuery({
        startDate: sortedDates[0],
        endDate: sortedDates[sortedDates.length - 1]
      })}`
    );
    const remoteKeys = new Set(
      remoteRecords
        .filter((record) => typeof record.glucoseMmol === "number" && Number.isFinite(record.glucoseMmol))
        .map((record) => `${record.recordedOn}:${record.glucoseMmol!.toFixed(1)}`)
    );

    for (const point of recordedPoints) {
      const glucoseMmol = typeof point.glucoseMmol === "number" && Number.isFinite(point.glucoseMmol) ? point.glucoseMmol : null;
      if (glucoseMmol === null) {
        continue;
      }

      const recordKey = `${point.date}:${glucoseMmol.toFixed(1)}`;
      if (remoteKeys.has(recordKey)) {
        continue;
      }

      await request("/api/records/care", {
        method: "POST",
        body: JSON.stringify({
          recordedOn: point.date,
          category: "监测",
          itemName: "血糖记录",
          durationMinutes: 0,
          status: "recovered",
          note: "从账号本地缓存恢复的血糖记录",
          glucoseMmol
        })
      });

      remoteKeys.add(recordKey);
    }
  })().finally(() => {
    glucoseRecoveryTasks.delete(identity.scopeKey);
  });

  glucoseRecoveryTasks.set(identity.scopeKey, task);
  await task;
}

function getStepSyncTaskKey(identity: DataIdentity, focusDate?: string) {
  return `${identity.scopeKey}:${focusDate ?? "today"}`;
}

function getStepRecordSourcePriority(record: Pick<StepSyncRecord, "source">) {
  if (record.source === DEVICE_STEP_COUNTER_SOURCE) {
    return 1;
  }
  return 0;
}

function resolveDisplayStepSource(record: Pick<StepSyncRecord, "source" | "steps">) {
  if (record.source === DEVICE_STEP_COUNTER_SOURCE && record.steps <= 0) {
    return DEVICE_STEP_COUNTER_PENDING_SOURCE;
  }

  return record.source;
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

function getMetricNumericValue(snapshot: DashboardSnapshot, metricId: string) {
  const raw = snapshot.metrics.find((metric) => metric.id === metricId)?.value;
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeDashboardSnapshotWithStepRecords(snapshot: DashboardSnapshot, stepRecords: ServerStepRecordSyncRequest["records"]) {
  if (stepRecords.length === 0) {
    return snapshot;
  }

  const stepsByDate = new Map(stepRecords.map((record) => [record.recordedOn, record]));
  const focusStepRecord = stepsByDate.get(snapshot.focusDate);
  const existingFocusMetricValue = getMetricNumericValue(snapshot, "steps");
  const resolvedFocusSteps = focusStepRecord ? Math.max(existingFocusMetricValue, focusStepRecord.steps) : existingFocusMetricValue;
  const resolvedFocusSource =
    focusStepRecord && focusStepRecord.steps >= existingFocusMetricValue
      ? resolveDisplayStepSource(focusStepRecord)
      : snapshot.metrics.find((metric) => metric.id === "steps")?.source ?? "连接设备步数后自动同步";

  const nextMetrics = snapshot.metrics.some((metric) => metric.id === "steps")
    ? snapshot.metrics.map((metric) =>
        metric.id === "steps"
          ? {
              ...metric,
              value: `${resolvedFocusSteps}`,
              source: resolvedFocusSource
            }
          : metric
      )
    : [
        ...snapshot.metrics,
        {
          id: "steps",
          label: "步数",
          value: `${resolvedFocusSteps}`,
          unit: "步",
          descriptor: "低强度活动",
          source: resolvedFocusSource
        }
      ];

  const nextHistory = snapshot.history.map((point) => {
    const synced = stepsByDate.get(point.date);
    if (!synced) {
      return point;
    }

    const nextSteps = Math.max(point.steps, synced.steps);
    return {
      ...point,
      steps: nextSteps,
      stepsSource:
        synced.steps >= point.steps ? resolveDisplayStepSource(synced) : point.stepsSource ?? resolveDisplayStepSource(synced)
    };
  });

  return {
    ...snapshot,
    metrics: nextMetrics,
    history: nextHistory
  };
}

async function getMergedLocalStepRecords(session?: AuthSession | null, focusDate?: string) {
  const deviceStepCounter = await readDeviceStepCounterRecords(session, { endDate: focusDate, days: 7 });

  return mergeStepRecords(deviceStepCounter.state.status === "ready" ? deviceStepCounter.records : []);
}

async function syncStepSources(identity: DataIdentity, focusDate?: string) {
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
      await request("/api/records/steps/sync", {
        method: "POST",
        body: JSON.stringify({
          records: mergedRecords
        } satisfies ServerStepRecordSyncRequest)
      });
    } catch (error) {
      if (deviceStepCounterRecords.length > 0) {
        await markDeviceStepCounterSyncFailure(identity.session, error);
      }
      throw error;
    }

    const deviceStepCounterSyncedDays = mergedRecords.filter((record) => record.source === DEVICE_STEP_COUNTER_SOURCE).length;
    if (!deviceStepCounterOutcome.error && deviceStepCounterSyncedDays > 0) {
      await markDeviceStepCounterSyncSuccess(identity.session, deviceStepCounterSyncedDays);
    }
  })().finally(() => {
    stepSyncTasks.delete(taskKey);
  });

  stepSyncTasks.set(taskKey, task);
  await task;
}

export const api = {
  login(payload: LoginPayload) {
    return request<AuthSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  register(payload: RegisterPayload) {
    return request<AuthSession>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getHealthProfile(sessionOverride?: AuthSession | null) {
    // 登录态优先从服务端拉取，但最终仍会落回本地缓存，
    // 这样后续页面读取可以获得一份已经合并过、相对稳定的档案副本。
    const identity = await resolveIdentity(sessionOverride);

    if (!identity.session) {
      return loadScopedProfile(identity);
    }

    const stored = await loadScopedProfile(identity);

    try {
      const remote = await request<ServerProfileResponse>("/api/profile");
      const recovered = await recoverServerProfile(identity, remote, stored);
      const merged = mergeServerProfile(recovered, stored, identity.session);
      return persistScopedProfile(identity, merged);
    } catch (error) {
      if (isAuthExpiredError(error)) {
        throw error;
      }

      return stored;
    }
  },

  async saveHealthProfile(payload: HealthProfile) {
    const identity = await resolveIdentity();
    const now = new Date().toISOString();
    const localProfile: HealthProfile = {
      ...payload,
      email: payload.email ?? identity.session?.email ?? null,
      nickname: payload.nickname.trim(),
      conditionLabel: payload.conditionLabel.trim(),
      primaryTarget: payload.primaryTarget.trim(),
      updatedAt: now,
      completedAt: payload.completedAt || now
    };

    if (!identity.session) {
      await persistScopedProfile(identity, localProfile);
      return localProfile;
    }

    const remote = await pushProfileToServer(localProfile);
    const merged = mergeServerProfile(remote, localProfile, identity.session);
    return persistScopedProfile(identity, merged);
  },

  async getDashboardSnapshot(date?: string) {
    // 仪表盘读取前先尝试做一次账号血糖补偿，
    // 这样用户在游客态录过的数据，登录后也更容易体现在服务端视图里。
    const identity = await resolveIdentity();

    if (!identity.session) {
      try {
        await syncStepSources(identity, date);
      } catch {
        // Reading device steps should not block guest-mode rendering.
      }

      const fallbackSnapshot = await getFallbackDashboardSnapshot(identity.scopeKey, date);
      const deviceSteps = await getMergedLocalStepRecords(identity.session, date);
      return mergeDashboardSnapshotWithStepRecords(fallbackSnapshot, deviceSteps);
    }

    try {
      await recoverAccountGlucoseRecords(identity);
    } catch {
      // 数据补偿属于尽力而为，失败时不应该阻塞当前页面读取。
    }

    try {
      await syncStepSources(identity, date);
    } catch {
      // Step sync is best-effort and should not block the dashboard.
    }

    const snapshot = await request<DashboardSnapshot>(`/api/dashboard/snapshot${buildQuery({ date })}`, {}, () =>
      getFallbackDashboardSnapshot(identity.scopeKey, date)
    );

    if (snapshot.dataSource === "server") {
      return snapshot;
    }

    const deviceSteps = await getMergedLocalStepRecords(identity.session, date);
    return mergeDashboardSnapshotWithStepRecords(snapshot, deviceSteps);
  },

  async getChatThread(date?: string) {
    const identity = await resolveIdentity();

    if (!identity.session) {
      return getFallbackChatThread(identity.scopeKey, date);
    }

    return request<ChatThread>(`/api/interaction/thread${buildQuery({ date })}`, {}, () => getFallbackChatThread(identity.scopeKey, date));
  },

  async sendChatMessage(payload: ChatSendPayload) {
    const identity = await resolveIdentity();

    if (!identity.session) {
      return sendFallbackChatMessage(identity.scopeKey, payload);
    }

    return request<ChatSendResult>("/api/interaction/messages", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async submitAdjustmentFeedback(payload: DashboardFeedbackPayload) {
    const identity = await resolveIdentity();

    if (!identity.session) {
      return submitFallbackDashboardFeedback(identity.scopeKey, payload);
    }

    return request<DashboardSnapshot>("/api/dashboard/adjustment-feedback", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getDeviceStepCounterSyncStatus(sessionOverride?: AuthSession | null) {
    const identity = await resolveIdentity(sessionOverride);
    return refreshDeviceStepCounterState(identity.session);
  },

  async connectDeviceStepCounter(sessionOverride?: AuthSession | null, focusDate?: string) {
    const identity = await resolveIdentity(sessionOverride);
    const state = await requestDeviceStepCounterPermission(identity.session);

    if (state.status === "ready") {
      await syncStepSources(identity, focusDate);
    }

    return refreshDeviceStepCounterState(identity.session);
  },

  async syncDeviceStepCounter(sessionOverride?: AuthSession | null, focusDate?: string) {
    const identity = await resolveIdentity(sessionOverride);
    await syncStepSources(identity, focusDate);
    return (await getCachedDeviceStepCounterState(identity.session)) ?? refreshDeviceStepCounterState(identity.session);
  },

  async syncStepSources(sessionOverride?: AuthSession | null, focusDate?: string) {
    const identity = await resolveIdentity(sessionOverride);
    await syncStepSources(identity, focusDate);
  },

  openDeviceStepCounterSettings() {
    openDeviceStepCounterSettingsApp();
  }
};
