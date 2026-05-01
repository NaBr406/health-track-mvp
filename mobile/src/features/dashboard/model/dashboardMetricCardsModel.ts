import { parseLeadingNumber } from "../../../lib/utils";
import type { DashboardMetric, DashboardSnapshot, HealthProfile, StepHourBucket } from "../../../types";
import { buildGlucoseChart, getRecordedGlucoseHistory, hasGlucoseForecast, resolveForecastSourceLabel } from "./dashboardGlucoseChartModel";
import type { MetricCardMeta, StepInlineChartMeta } from "./dashboardModelTypes";

const DEFAULT_CALORIE_TARGET = 1700;
const DEFAULT_EXERCISE_TARGET = 40;
const DEFAULT_STEP_TARGET = 8000;
const STEP_CHART_EMPTY_LABEL = "连接设备后显示近 8 小时步数";

export function buildMetricCards(snapshot: DashboardSnapshot | null, healthProfile: HealthProfile | null, now: Date): MetricCardMeta[] {
  const calorieTarget = resolveCalorieTarget(healthProfile);
  const intakeCalories = getMetricNumber(snapshot, "calories");
  const exerciseValue = getMetricNumber(snapshot, "exercise");
  const stepsValue = getMetricNumber(snapshot, "steps");
  const burnedCalories = estimateExerciseBurnedCalories(stepsValue, exerciseValue, healthProfile);
  const stepsSource = findMetric(snapshot, "steps")?.source || "连接设备步数后自动同步";
  const glucoseChart = buildGlucoseChart(snapshot, now);
  const hasGlucoseData = glucoseChart.kind === "series";
  const hasForecast = hasGlucoseForecast(snapshot);
  const hasRecordedHistory = getRecordedGlucoseHistory(snapshot).length > 0;

  return [
    {
      kind: "activity_summary",
      id: "activity-summary",
      stats: [
        {
          id: "calories",
          label: "热量",
          iconName: "flame",
          iconColor: "#FF7A1A",
          valueText: formatSummaryInteger(burnedCalories),
          targetText: `/ ${Math.round(calorieTarget)} 千卡`
        },
        {
          id: "steps",
          label: "步数",
          iconName: "footsteps",
          iconColor: "#F3B400",
          valueText: formatSummaryInteger(stepsValue),
          targetText: `/${DEFAULT_STEP_TARGET}步`
        },
        {
          id: "exercise",
          label: "活动",
          iconName: "body",
          iconColor: "#2ECC71",
          valueText: formatSummaryInteger(exerciseValue),
          targetText: `/${Math.round(DEFAULT_EXERCISE_TARGET / 7)}次`
        }
      ],
      footer: {
        label: "中高强度活动",
        valueText: `${formatSummaryInteger(exerciseValue)} 分钟`,
        iconName: "time",
        iconColor: "#3DA5F5"
      },
      helperText: stepsSource
    },
    {
      kind: "metric",
      layout: "half",
      id: "calories",
      label: "热量摄入",
      descriptor: "今日饮食记录",
      iconName: "flame-outline",
      valueText: formatSummaryInteger(intakeCalories),
      unitText: "kcal",
      statusText: intakeCalories >= calorieTarget ? "已接近今日摄入目标" : `距离目标 ${Math.max(Math.round(calorieTarget - intakeCalories), 0)} kcal`,
      helperText: `目标 ${Math.round(calorieTarget)} kcal`,
      progress: clamp(intakeCalories / calorieTarget)
    },
    {
      kind: "metric",
      layout: "full",
      id: "glucose",
      label: hasForecast ? "血糖 8h 趋势" : "血糖趋势",
      descriptor: hasGlucoseData
        ? hasForecast
          ? resolveForecastSourceLabel(snapshot)
          : hasRecordedHistory
            ? "近 7 天实测记录"
            : "最新血糖记录"
        : "暂无血糖数据",
      iconName: "pulse-outline",
      valueText: hasGlucoseData ? glucoseChart.currentValue.toFixed(1) : "--",
      unitText: "mmol/L",
      statusText: hasGlucoseData && snapshot?.glucoseRiskLevel ? `风险 ${snapshot.glucoseRiskLevel}` : hasGlucoseData ? "已展示实测相关曲线" : "暂无数据",
      helperText: hasGlucoseData ? (snapshot?.calibrationApplied ? "已按最新实测值更新" : "") : "记录血糖后自动显示曲线",
      chart: glucoseChart
    }
  ];
}

function buildStepInlineChart(stepTrend8h?: StepHourBucket[]): StepInlineChartMeta {
  if (!stepTrend8h || stepTrend8h.length === 0) {
    return {
      kind: "empty",
      emptyLabel: STEP_CHART_EMPTY_LABEL
    };
  }

  const bars = stepTrend8h.map((bucket) => ({
    label: bucket.label,
    steps: bucket.steps,
    isCurrentHour: bucket.isCurrentHour
  }));

  return {
    kind: "bars",
    bars,
    maxSteps: Math.max(1, ...bars.map((bar) => bar.steps))
  };
}

function resolveCalorieTarget(healthProfile: HealthProfile | null) {
  const value = parseLeadingNumber(healthProfile?.primaryTarget);
  return value && value >= 1200 && value <= 2600 ? value : DEFAULT_CALORIE_TARGET;
}

function estimateExerciseBurnedCalories(steps: number, exerciseMinutes: number, healthProfile: HealthProfile | null) {
  const safeSteps = Math.max(0, Math.round(steps));
  const safeExerciseMinutes = Math.max(0, Math.round(exerciseMinutes));
  const weightKg = healthProfile?.weightKg && healthProfile.weightKg > 25 ? healthProfile.weightKg : 65;
  const strideMeters = healthProfile?.heightCm && healthProfile.heightCm > 100 ? healthProfile.heightCm * 0.415 / 100 : 0.7;
  const walkingDistanceKm = safeSteps * strideMeters / 1000;
  const walkingBurn = walkingDistanceKm * weightKg * 0.53;
  const trainingBurn = safeExerciseMinutes * weightKg * 0.085;

  return Math.max(0, Math.round(walkingBurn + trainingBurn));
}

function findMetric(snapshot: DashboardSnapshot | null, id: string): DashboardMetric | undefined {
  return snapshot?.metrics.find((metric) => metric.id === id);
}

function getMetricNumber(snapshot: DashboardSnapshot | null, id: string) {
  return parseLeadingNumber(findMetric(snapshot, id)?.value) ?? 0;
}

function formatMetricInteger(value: number) {
  return value > 0 ? `${Math.round(value)}` : "--";
}

function formatSummaryInteger(value: number) {
  return `${Math.max(0, Math.round(value))}`;
}

function clamp(value: number, min = 0, max = 1) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
