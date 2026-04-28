import {
  getFallbackDashboardSnapshot,
  getFallbackRecordedGlucosePoints,
  submitFallbackDashboardFeedback
} from "../../../lib/mockStore";
import { getTodayString } from "../../../lib/utils";
import { buildQuery, request } from "../../../shared/api/client";
import { resolveIdentity, type DataIdentity } from "../../../shared/api/identity";
import type { DashboardFeedbackPayload, DashboardSnapshot, StepHourBucket } from "../../../types";
import {
  getMergedLocalStepRecords,
  getRecentHourlyStepTrend,
  resolveDisplayStepSource,
  syncStepSourcesForIdentity
} from "../../steps/api/deviceStepCounterApi";

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

const glucoseRecoveryTasks = new Map<string, Promise<void>>();

function shouldAttachStepTrend(date?: string) {
  return (date ?? getTodayString()) === getTodayString();
}

function withLocalStepTrend(snapshot: DashboardSnapshot, stepTrend8h: StepHourBucket[], date?: string) {
  const today = getTodayString();
  const targetDate = date ?? today;

  if (targetDate !== today || snapshot.focusDate !== targetDate) {
    return snapshot;
  }

  return {
    ...snapshot,
    stepTrend8h
  };
}

async function recoverAccountGlucoseRecords(identity: DataIdentity) {
  if (!identity.session) {
    return;
  }

  const existingTask = glucoseRecoveryTasks.get(identity.scopeKey);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
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

async function getDashboardSnapshot(date?: string) {
  const identity = await resolveIdentity();
  const shouldLoadStepTrend = shouldAttachStepTrend(date);

  if (!identity.session) {
    try {
      await syncStepSourcesForIdentity(identity, date);
    } catch {
      // Reading device steps should not block guest-mode rendering.
    }

    const [fallbackSnapshot, deviceSteps, stepTrend8h] = await Promise.all([
      getFallbackDashboardSnapshot(identity.scopeKey, date),
      getMergedLocalStepRecords(identity.session, date),
      shouldLoadStepTrend ? getRecentHourlyStepTrend(identity.session) : Promise.resolve([] as StepHourBucket[])
    ]);

    return withLocalStepTrend(mergeDashboardSnapshotWithStepRecords(fallbackSnapshot, deviceSteps), stepTrend8h, date);
  }

  try {
    await recoverAccountGlucoseRecords(identity);
  } catch {
    // Data recovery is best effort and should not block the dashboard.
  }

  try {
    await syncStepSourcesForIdentity(identity, date);
  } catch {
    // Step sync is best-effort and should not block the dashboard.
  }

  const [snapshot, stepTrend8h] = await Promise.all([
    request<DashboardSnapshot>(`/api/dashboard/snapshot${buildQuery({ date })}`, {}, () =>
      getFallbackDashboardSnapshot(identity.scopeKey, date)
    ),
    shouldLoadStepTrend ? getRecentHourlyStepTrend(identity.session) : Promise.resolve([] as StepHourBucket[])
  ]);
  const snapshotWithStepTrend = withLocalStepTrend(snapshot, stepTrend8h, date);

  if (snapshotWithStepTrend.dataSource === "server") {
    return snapshotWithStepTrend;
  }

  const deviceSteps = await getMergedLocalStepRecords(identity.session, date);
  return mergeDashboardSnapshotWithStepRecords(snapshotWithStepTrend, deviceSteps);
}

async function submitAdjustmentFeedback(payload: DashboardFeedbackPayload) {
  const identity = await resolveIdentity();

  if (!identity.session) {
    return submitFallbackDashboardFeedback(identity.scopeKey, payload);
  }

  return request<DashboardSnapshot>("/api/dashboard/adjustment-feedback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export const dashboardApi = {
  getDashboardSnapshot,
  submitAdjustmentFeedback
};
