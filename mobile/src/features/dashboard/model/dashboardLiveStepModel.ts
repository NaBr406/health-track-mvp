import { parseLeadingNumber } from "../../../lib/utils";
import type { DashboardSnapshot, StepSyncRecord } from "../../../types";

const DEVICE_STEP_COUNTER_PENDING_SOURCE = "已启用设备计步，等待下一次采样";

function resolveLiveStepSource(record: StepSyncRecord) {
  return record.steps > 0 ? record.source : DEVICE_STEP_COUNTER_PENDING_SOURCE;
}

export function applyLiveStepRecord(snapshot: DashboardSnapshot | null, record: StepSyncRecord) {
  if (!snapshot) {
    return snapshot;
  }

  const liveSource = resolveLiveStepSource(record);
  const nextMetrics = snapshot.metrics.some((metric) => metric.id === "steps")
    ? snapshot.metrics.map((metric) =>
        metric.id === "steps" && snapshot.focusDate === record.recordedOn
          ? (() => {
              const currentSteps = parseLeadingNumber(metric.value) ?? 0;
              const nextSteps = Math.max(currentSteps, record.steps);
              return {
                ...metric,
                value: `${nextSteps}`,
                source: record.steps >= currentSteps ? liveSource : metric.source
              };
            })()
          : metric
      )
    : snapshot.focusDate === record.recordedOn
      ? [
          ...snapshot.metrics,
          {
            id: "steps",
            label: "步数",
            value: `${record.steps}`,
            unit: "步",
            descriptor: "低强度活动",
            source: liveSource
          }
        ]
      : snapshot.metrics;

  const nextHistory = snapshot.history.map((point) =>
    point.date === record.recordedOn
      ? {
          ...point,
          steps: Math.max(point.steps, record.steps),
          stepsSource: record.steps >= point.steps ? liveSource : point.stepsSource
        }
      : point
  );

  return {
    ...snapshot,
    refreshedAt: new Date().toISOString(),
    metrics: nextMetrics,
    history: nextHistory
  };
}
