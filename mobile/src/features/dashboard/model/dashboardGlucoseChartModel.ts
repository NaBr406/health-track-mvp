import type { DashboardMetric, DashboardSnapshot, GlucoseForecastPoint, MonitoringHistoryPoint } from "../../../types";
import type { GlucoseChartMeta, GlucoseChartPoint, GlucoseChartSeriesMeta } from "./dashboardModelTypes";

const FORECAST_WINDOW_HOURS = 8;
const FORECAST_HOUR_OFFSET_PRECISION = 2;
const CURRENT_MARKER_SNAP_HOURS = 0.12;

export function buildGlucoseChart(snapshot: DashboardSnapshot | null, now: Date): GlucoseChartMeta {
  // 血糖卡片优先展示预测；没有预测时再退回历史记录；
  // 两者都没有时才进入空态。
  const forecast = getGlucoseForecast(snapshot);
  if (forecast.length > 0) {
    return buildForecastChart(snapshot, forecast, now);
  }

  const recordedHistory = getRecordedGlucoseHistory(snapshot);
  if (recordedHistory.length > 0) {
    return buildHistoryChart(recordedHistory);
  }

  return {
    kind: "empty",
    emptyLabel: "暂无数据",
    footerText: "记录血糖后，这里会展示实际趋势和风险区间。"
  };
}

export function resolveForecastSourceLabel(snapshot: DashboardSnapshot | null) {
  if (snapshot?.forecastSource === "dify") {
    return "按实测值生成的 8 小时预测";
  }
  if (snapshot?.forecastSource === "local") {
    return "按实测值延展的本地趋势";
  }
  return findMetric(snapshot, "glucose")?.source || "实测记录";
}

export function hasGlucoseForecast(snapshot: DashboardSnapshot | null) {
  return getGlucoseForecast(snapshot).length > 0;
}

export function getRecordedGlucoseHistory(snapshot: DashboardSnapshot | null) {
  return (snapshot?.history ?? []).filter(
    (item): item is MonitoringHistoryPoint & { glucoseMmol: number } =>
      item.glucoseSource === "recorded" && typeof item.glucoseMmol === "number" && Number.isFinite(item.glucoseMmol)
  );
}

function getGlucoseForecast(snapshot: DashboardSnapshot | null) {
  const dedupedForecast = new Map<number, GlucoseForecastPoint>();

  for (const point of snapshot?.glucoseForecast8h ?? []) {
    if (!Number.isFinite(point.hourOffset) || !Number.isFinite(point.predictedGlucoseMmol)) {
      continue;
    }

    const normalizedHourOffset = normalizeForecastHourOffset(point.hourOffset);
    const normalizedPoint: GlucoseForecastPoint = {
      ...point,
      hourOffset: normalizedHourOffset,
      predictedGlucoseMmol: roundChartValue(point.predictedGlucoseMmol)
    };
    const existingPoint = dedupedForecast.get(normalizedHourOffset);

    if (!existingPoint || shouldReplaceForecastPoint(existingPoint, normalizedPoint)) {
      dedupedForecast.set(normalizedHourOffset, normalizedPoint);
    }
  }

  return [...dedupedForecast.values()].sort((left, right) => left.hourOffset - right.hourOffset);
}

function buildForecastChart(snapshot: DashboardSnapshot | null, forecast: GlucoseForecastPoint[], now: Date): GlucoseChartSeriesMeta {
  // 预测图除了展示未来点位，还会把“当前时刻”插回曲线里，
  // 让用户更容易理解自己处在这条 8 小时曲线的哪个位置。
  const sorted = [...forecast].sort((left, right) => left.hourOffset - right.hourOffset);
  const forecastStart = resolveForecastStartTime(snapshot, now);
  const lastHour = Math.max(...sorted.map((point) => point.hourOffset), 0);
  const basePoints = sorted.map((point) => ({
    label: formatClockLabel(addHours(forecastStart, point.hourOffset)),
    value: roundChartValue(point.predictedGlucoseMmol),
    pointType: point.pointType,
    xValue: point.hourOffset
  }));
  const liveSeries = insertCurrentGlucosePoint(basePoints, resolveElapsedHours(forecastStart, now), formatClockLabel(now));
  const values = liveSeries.points.map((point) => point.value);
  const ticks = buildYAxisTicks(values);

  return {
    kind: "series",
    points: liveSeries.points,
    currentValue: liveSeries.currentValue,
    xMin: 0,
    xMax: lastHour,
    minValue: ticks[ticks.length - 1],
    maxValue: ticks[0],
    xAxisItems: basePoints.map((point) => ({ value: point.xValue, label: point.label })),
    yTicks: ticks,
    footerText: buildForecastFooter(snapshot, values, forecastStart)
  };
}

function buildHistoryChart(history: Array<MonitoringHistoryPoint & { glucoseMmol: number }>): GlucoseChartSeriesMeta {
  const points = history.map((item, index) => ({
    label: formatHistoryAxisLabel(item.date),
    value: Number(item.glucoseMmol.toFixed(1)),
    pointType: index === history.length - 1 ? "measured_anchor" : "forecast",
    xValue: index
  }));
  const values = points.map((item) => item.value);
  const ticks = buildYAxisTicks(values);

  return {
    kind: "series",
    points,
    currentValue: points[points.length - 1]?.value ?? 0,
    xMin: 0,
    xMax: Math.max(points.length - 1, 0),
    minValue: ticks[ticks.length - 1],
    maxValue: ticks[0],
    xAxisItems: points.map((point) => ({ value: point.xValue, label: point.label })),
    yTicks: ticks,
    footerText: buildHistoryFooter(values, history.length)
  };
}

function formatHistoryAxisLabel(date: string) {
  const [, month = "0", day = "0"] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function buildHistoryFooter(values: number[], sampleCount: number) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return `近 ${sampleCount} 次实测，均值 ${average(values).toFixed(1)} mmol/L，波动 ${(maxValue - minValue).toFixed(1)}。`;
}

function buildForecastFooter(snapshot: DashboardSnapshot | null, values: number[], forecastStart: Date) {
  const parts = [`均值 ${average(values).toFixed(1)} mmol/L`];
  if (snapshot?.glucoseRiskLevel) {
    parts.push(`风险 ${snapshot.glucoseRiskLevel}`);
  }
  if (typeof snapshot?.peakGlucoseMmol === "number") {
    const peakTime = typeof snapshot?.peakHourOffset === "number" ? `（${formatClockLabel(addHours(forecastStart, snapshot.peakHourOffset))}）` : "";
    parts.push(`峰值 ${snapshot.peakGlucoseMmol.toFixed(1)}${peakTime}`);
  }
  if (typeof snapshot?.returnToBaselineHourOffset === "number") {
    parts.push(`约 ${formatClockLabel(addHours(forecastStart, snapshot.returnToBaselineHourOffset))} 回到基线`);
  }
  return parts.join("，") + "。";
}

function buildYAxisTicks(values: number[]) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 0.3);
  const padding = Math.max(range * 0.18, 0.2);
  const rawMin = Math.max(0, minValue - padding);
  const rawMax = maxValue + padding;
  const targetTickCount = range < 1.2 ? 5 : 4;
  const step = resolveGlucoseAxisStep(rawMax - rawMin, targetTickCount);
  const bottom = Math.floor(rawMin / step) * step;
  const top = Math.ceil(rawMax / step) * step;
  const tickCount = Math.max(2, Math.round((top - bottom) / step) + 1);

  return Array.from({ length: tickCount }, (_, index) => roundAxisNumber(top - index * step));
}

function resolveGlucoseAxisStep(range: number, targetTickCount: number) {
  const rawStep = range / Math.max(targetTickCount - 1, 1);
  const normalizedCandidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5];
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawStep, 0.01)));
  const candidateSteps = Array.from(
    new Set(
      [-1, 0, 1].flatMap((offset) => {
        const scaledMagnitude = magnitude * 10 ** offset;
        return normalizedCandidates.map((candidate) => candidate * scaledMagnitude);
      })
    )
  )
    .filter((candidate) => candidate > 0)
    .sort((left, right) => left - right);

  const bestStep =
    candidateSteps.reduce<{ step: number; score: number } | null>((best, candidate) => {
      const tickCount = range / candidate + 1;
      if (tickCount < 3 || tickCount > 6) {
        return best;
      }

      const tickCountScore = Math.abs(tickCount - targetTickCount);
      const stepScore = Math.abs(candidate - rawStep) / rawStep;
      const score = tickCountScore * 3 + stepScore;

      if (!best || score < best.score) {
        return { step: candidate, score };
      }

      return best;
    }, null)?.step ?? rawStep;

  return bestStep;
}

function roundAxisNumber(value: number) {
  return Number(value.toFixed(2));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundChartValue(value: number) {
  return Number(value.toFixed(1));
}

function addHours(base: Date, hourOffset: number) {
  return new Date(base.getTime() + hourOffset * 60 * 60 * 1000);
}

function parseSnapshotTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveForecastStartTime(snapshot: DashboardSnapshot | null, fallback: Date) {
  return parseSnapshotTime(snapshot?.adjustment.generatedAt) ?? parseSnapshotTime(snapshot?.refreshedAt) ?? fallback;
}

function resolveElapsedHours(start: Date, now: Date) {
  return (now.getTime() - start.getTime()) / (60 * 60 * 1000);
}

function formatClockLabel(value: Date) {
  return `${`${value.getHours()}`.padStart(2, "0")}:${`${value.getMinutes()}`.padStart(2, "0")}`;
}

function insertCurrentGlucosePoint(points: GlucoseChartPoint[], currentX: number, currentLabel: string) {
  // 当前时刻并不一定正好落在预测采样点上，
  // 所以这里会把它吸附到最近的点位或插入到两点之间，保证图上有明确当前位置。
  if (points.length === 0) {
    return {
      points,
      currentValue: 0
    };
  }

  const firstX = points[0].xValue;
  const lastX = points[points.length - 1].xValue;
  const clampedX = clamp(currentX, firstX, lastX);
  const nearestIndex = findNearestGlucosePointIndex(points, clampedX);
  const snapTolerance = resolveCurrentMarkerSnapHours(points);

  if (nearestIndex >= 0 && Math.abs(points[nearestIndex].xValue - clampedX) <= snapTolerance) {
    return {
      points: points.map((point, index) =>
        index === nearestIndex
          ? {
              ...point,
              label: currentLabel,
              pointType: "current_marker"
            }
          : point
      ),
      currentValue: points[nearestIndex].value
    };
  }

  if (clampedX <= firstX) {
    return {
      points: [{ ...points[0], label: currentLabel, pointType: "current_marker" }, ...points.slice(1)],
      currentValue: points[0].value
    };
  }

  if (clampedX >= lastX) {
    return {
      points: [...points.slice(0, -1), { ...points[points.length - 1], label: currentLabel, pointType: "current_marker" }],
      currentValue: points[points.length - 1].value
    };
  }

  const insertionIndex = points.findIndex((point) => point.xValue > clampedX);
  const previousPoint = points[insertionIndex - 1];
  const nextPoint = points[insertionIndex];
  const ratio = (clampedX - previousPoint.xValue) / Math.max(nextPoint.xValue - previousPoint.xValue, 0.001);
  const currentValue = roundChartValue(previousPoint.value + (nextPoint.value - previousPoint.value) * ratio);
  const currentPoint: GlucoseChartPoint = {
    label: currentLabel,
    value: currentValue,
    pointType: "current_marker",
    xValue: clampedX
  };

  return {
    points: [...points.slice(0, insertionIndex), currentPoint, ...points.slice(insertionIndex)],
    currentValue
  };
}

function normalizeForecastHourOffset(hourOffset: number) {
  return Number(clamp(hourOffset, 0, FORECAST_WINDOW_HOURS).toFixed(FORECAST_HOUR_OFFSET_PRECISION));
}

function shouldReplaceForecastPoint(existingPoint: GlucoseForecastPoint, nextPoint: GlucoseForecastPoint) {
  const existingPriority = resolveForecastPointPriority(existingPoint.pointType);
  const nextPriority = resolveForecastPointPriority(nextPoint.pointType);

  if (existingPriority !== nextPriority) {
    return nextPriority > existingPriority;
  }

  return true;
}

function resolveForecastPointPriority(pointType?: string) {
  if (pointType === "measured_anchor") {
    return 2;
  }
  if (pointType === "forecast") {
    return 1;
  }
  return 0;
}

function findNearestGlucosePointIndex(points: GlucoseChartPoint[], targetX: number) {
  return points.reduce(
    (bestIndex, point, index, collection) => {
      if (bestIndex < 0) {
        return index;
      }

      const bestDistance = Math.abs(collection[bestIndex].xValue - targetX);
      const nextDistance = Math.abs(point.xValue - targetX);
      return nextDistance < bestDistance ? index : bestIndex;
    },
    -1
  );
}

function resolveCurrentMarkerSnapHours(points: GlucoseChartPoint[]) {
  if (points.length < 2) {
    return CURRENT_MARKER_SNAP_HOURS;
  }

  const smallestGap = points.slice(1).reduce((bestGap, point, index) => {
    const gap = Math.abs(point.xValue - points[index].xValue);
    if (gap <= 0.001) {
      return bestGap;
    }
    if (bestGap === null || gap < bestGap) {
      return gap;
    }
    return bestGap;
  }, null as number | null);

  if (smallestGap == null) {
    return CURRENT_MARKER_SNAP_HOURS;
  }

  return Math.min(CURRENT_MARKER_SNAP_HOURS, smallestGap / 3);
}

function findMetric(snapshot: DashboardSnapshot | null, id: string): DashboardMetric | undefined {
  return snapshot?.metrics.find((metric) => metric.id === id);
}

function clamp(value: number, min = 0, max = 1) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
