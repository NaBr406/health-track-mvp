import { parseLeadingNumber } from "../../../lib/utils";
import type { DashboardMetric, DashboardSnapshot, HealthProfile } from "../../../types";
import { buildGlucoseChart, getRecordedGlucoseHistory, hasGlucoseForecast, resolveForecastSourceLabel } from "./dashboardGlucoseChartModel";
import type { MetricCardMeta } from "./dashboardModelTypes";

const DEFAULT_CALORIE_TARGET = 1700;
const DEFAULT_EXERCISE_TARGET = 40;
const DEFAULT_STEP_TARGET = 8000;

export function buildMetricCards(snapshot: DashboardSnapshot | null, healthProfile: HealthProfile | null, now: Date): MetricCardMeta[] {
  // 这里把后端/本地快照转成纯 UI 模型，
  // 避免 JSX 内部到处散落“取值 + 容错 + 格式化”逻辑。
  const calorieTarget = resolveCalorieTarget(healthProfile);
  const calorieValue = getMetricNumber(snapshot, "calories");
  const exerciseValue = getMetricNumber(snapshot, "exercise");
  const stepsValue = getMetricNumber(snapshot, "steps");
  const stepsSource = findMetric(snapshot, "steps")?.source || "连接设备步数后自动同步";
  const glucoseChart = buildGlucoseChart(snapshot, now);
  const hasGlucoseData = glucoseChart.kind === "series";
  const hasForecast = hasGlucoseForecast(snapshot);
  const hasRecordedHistory = getRecordedGlucoseHistory(snapshot).length > 0;

  return [
    {
      id: "calories",
      label: "热量",
      descriptor: "今日摄入",
      iconName: "flame-outline",
      valueText: formatMetricInteger(calorieValue),
      unitText: "kcal",
      statusText: calorieValue >= calorieTarget ? "接近目标区间" : `距离目标 ${Math.max(Math.round(calorieTarget - calorieValue), 0)} kcal`,
      helperText: `目标 ${Math.round(calorieTarget)} kcal`,
      progress: clamp(calorieValue / calorieTarget)
    },
    {
      id: "exercise",
      label: "运动时长",
      descriptor: "主动训练",
      iconName: "fitness-outline",
      valueText: formatMetricInteger(exerciseValue),
      unitText: "min",
      statusText: exerciseValue >= DEFAULT_EXERCISE_TARGET ? "已达到今日建议" : `还需 ${Math.max(Math.round(DEFAULT_EXERCISE_TARGET - exerciseValue), 0)} 分钟`,
      helperText: `目标 ${DEFAULT_EXERCISE_TARGET} 分钟`,
      progress: clamp(exerciseValue / DEFAULT_EXERCISE_TARGET)
    },
    {
      id: "steps",
      label: "步数",
      descriptor: "全天活动",
      iconName: "walk-outline",
      valueText: formatMetricInteger(stepsValue),
      unitText: "步",
      statusText: stepsValue >= DEFAULT_STEP_TARGET ? "已达到今日建议" : `还需 ${Math.max(DEFAULT_STEP_TARGET - stepsValue, 0)} 步`,
      helperText: stepsSource,
      progress: clamp(stepsValue / DEFAULT_STEP_TARGET)
    },
    {
      id: "glucose",
      label: hasForecast ? "血糖 8h 趋势" : "血糖趋势",
      descriptor: hasGlucoseData ? (hasForecast ? resolveForecastSourceLabel(snapshot) : hasRecordedHistory ? "近 7 天实测记录" : "最新血糖记录") : "暂无血糖数据",
      iconName: "pulse-outline",
      valueText: hasGlucoseData ? glucoseChart.currentValue.toFixed(1) : "--",
      unitText: "mmol/L",
      statusText: hasGlucoseData && snapshot?.glucoseRiskLevel ? `风险 ${snapshot.glucoseRiskLevel}` : hasGlucoseData ? "已展示实测相关曲线" : "暂无数据",
      helperText: hasGlucoseData ? (snapshot?.calibrationApplied ? "已按最新实测值更新" : "") : "记录血糖后自动展示曲线",
      chart: glucoseChart
    }
  ];
}

function resolveCalorieTarget(healthProfile: HealthProfile | null) {
  const value = parseLeadingNumber(healthProfile?.primaryTarget);
  return value && value >= 1200 && value <= 2600 ? value : DEFAULT_CALORIE_TARGET;
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

function clamp(value: number, min = 0, max = 1) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
