import type {
  AdjustmentFeedback,
  DashboardMetric,
  DashboardSnapshot,
  GlucoseForecastPoint,
  HealthProfile,
  MonitoringHistoryPoint,
  PlanAdjustment
} from "../../types";
import { getShiftedDateString, getTodayString } from "../utils";
import { type FallbackStore, clonePoint, getPointForRead, hasGlucoseValue, loadStore } from "./fallbackStoreCore";

function historyWindow(store: FallbackStore, focusDate: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = getShiftedDateString(focusDate, index - 6);
    return getPointForRead(store, date);
  });
}

function buildRationale(point: MonitoringHistoryPoint, profile: HealthProfile | null) {
  const parts = [profile?.conditionLabel || "当前档案"];

  if (hasGlucoseValue(point)) {
    parts.push(`今日血糖 ${point.glucoseMmol!.toFixed(1)} mmol/L`);
  }

  if (point.steps > 0) {
    parts.push(`步数 ${point.steps} 步`);
  }

  return `基于 ${parts.join("、")} 推演。`;
}

function buildAdjustment(point: MonitoringHistoryPoint, date: string, profile: HealthProfile | null, feedback: AdjustmentFeedback): PlanAdjustment {
  const glucose = hasGlucoseValue(point) ? point.glucoseMmol! : null;
  let title = "维持当前方案";
  let parameterLabel = "CHO";
  let parameterDelta = "-10 g";
  let summary = "当前记录较少，先保持稳态饮食与规律作息，补充更多记录后再继续细化。";

  if (glucose !== null && glucose >= 8) {
    title = "抑制餐后波动";
    parameterDelta = "-18 g";
    summary = "优先压缩本餐精制碳水，并在餐后补一段轻步行，先把波动幅度收住。";
  } else if (point.steps < 5000) {
    title = "补齐活动量";
    parameterLabel = "ACT";
    parameterDelta = "+12 min";
    summary = "今天活动量偏低，建议先加一段低强度步行，把总体节律拉回稳定区间。";
  } else if (point.sleepHours > 0 && point.sleepHours < 6.5) {
    title = "修复恢复窗口";
    parameterLabel = "SLEEP";
    parameterDelta = "+0.5 h";
    summary = "先补足睡眠和恢复，再考虑增加训练强度，能更稳地降低第二天波动风险。";
  }

  return {
    id: `adjustment-${date}`,
    title,
    summary,
    parameterLabel,
    parameterDelta,
    rationale: buildRationale(point, profile),
    generatedAt: new Date().toISOString(),
    feedback
  };
}

function buildMetrics(point: MonitoringHistoryPoint): DashboardMetric[] {
  return [
    {
      id: "glucose",
      label: "血糖",
      value: hasGlucoseValue(point) ? point.glucoseMmol!.toFixed(1) : "--",
      unit: "mmol/L",
      descriptor: hasGlucoseValue(point) ? "最近一次记录" : "暂无血糖记录",
      source: hasGlucoseValue(point) ? "本地归档" : "暂无数据"
    },
    {
      id: "calories",
      label: "热量",
      value: `${point.calories}`,
      unit: "kcal",
      descriptor: "今日总摄入",
      source: "本地归档"
    },
    {
      id: "steps",
      label: "步数",
      value: `${point.steps}`,
      unit: "步",
      descriptor: "低强度活动",
      source: "本地归档"
    },
    {
      id: "exercise",
      label: "运动",
      value: `${point.exerciseMinutes}`,
      unit: "min",
      descriptor: "主动训练时长",
      source: "本地归档"
    },
    {
      id: "sleep",
      label: "睡眠",
      value: point.sleepHours > 0 ? point.sleepHours.toFixed(1) : "--",
      unit: "h",
      descriptor: "恢复窗口",
      source: point.sleepHours > 0 ? "本地归档" : "暂无数据"
    }
  ];
}

function buildObservation(point: MonitoringHistoryPoint) {
  if (hasGlucoseValue(point) && point.glucoseMmol! >= 8) {
    return "当前主要风险来自血糖偏高，建议优先控制餐后波动并补足餐后活动。";
  }

  if (point.sleepHours > 0 && point.sleepHours < 6.5) {
    return "当前主要风险来自恢复不足，今晚优先修复作息比额外加练更重要。";
  }

  if (point.steps < 5000) {
    return "当前主要风险来自活动量不足，先把步数和轻活动补起来。";
  }

  return "暂无血糖记录，补充监测值后这里会给出更明确的趋势解读。";
}

function buildHeadline(profile: HealthProfile | null) {
  if (profile?.conditionLabel) {
    return `今日方案围绕 ${profile.conditionLabel} 的稳定管理展开。`;
  }

  return "记录更多饮食、运动、睡眠和血糖信息后，系统会逐步形成你的个体化建议。";
}

function buildGlucoseForecast(point: MonitoringHistoryPoint): GlucoseForecastPoint[] {
  if (!hasGlucoseValue(point)) {
    return [];
  }

  const anchor = point.glucoseMmol!;
  const peak = Number((anchor + (anchor > 8 ? 1.1 : 0.8)).toFixed(1));

  return [
    { hourOffset: 0, predictedGlucoseMmol: anchor, pointType: "measured_anchor" },
    { hourOffset: 1, predictedGlucoseMmol: Number((anchor + 0.5).toFixed(1)), pointType: "forecast" },
    { hourOffset: 2, predictedGlucoseMmol: peak, pointType: "forecast" },
    { hourOffset: 4, predictedGlucoseMmol: Number((peak - 0.7).toFixed(1)), pointType: "forecast" },
    { hourOffset: 6, predictedGlucoseMmol: Number((anchor + 0.2).toFixed(1)), pointType: "forecast" },
    { hourOffset: 8, predictedGlucoseMmol: Number(Math.max(anchor - 0.1, 5.4).toFixed(1)), pointType: "forecast" }
  ];
}

export function buildSnapshot(store: FallbackStore, date = getTodayString()): DashboardSnapshot {
  // 本地仪表盘和聊天、反馈都从同一份离线状态推导，保证体验一致。
  const point = getPointForRead(store, date);
  const history = historyWindow(store, date);
  const feedback = store.feedbackByDate[date] ?? null;
  const adjustment = buildAdjustment(point, date, store.profile, feedback);
  const glucoseForecast8h = buildGlucoseForecast(point);
  const peakGlucoseMmol = glucoseForecast8h.length > 0 ? Math.max(...glucoseForecast8h.map((item) => item.predictedGlucoseMmol)) : null;
  const peakPoint = peakGlucoseMmol === null
    ? null
    : glucoseForecast8h.find((item) => item.predictedGlucoseMmol === peakGlucoseMmol) ?? null;

  return {
    focusDate: date,
    headline: buildHeadline(store.profile),
    adjustment,
    metrics: buildMetrics(point),
    observation: buildObservation(point),
    refreshedAt: new Date().toISOString(),
    history,
    glucoseRiskLevel: peakGlucoseMmol !== null ? (peakGlucoseMmol > 10 ? "高" : peakGlucoseMmol >= 8 ? "中" : "低") : null,
    calibrationApplied: glucoseForecast8h.length > 0 ? true : null,
    peakGlucoseMmol,
    peakHourOffset: peakPoint?.hourOffset ?? null,
    returnToBaselineHourOffset: glucoseForecast8h.length > 0 ? 6 : null,
    glucoseForecast8h,
    forecastSource: glucoseForecast8h.length > 0 ? "local" : null,
    dataSource: "mock"
  };
}

export async function getFallbackDashboardSnapshot(scopeKey: string, date = getTodayString()) {
  const store = await loadStore(scopeKey);
  return buildSnapshot(store, date);
}

export async function getFallbackRecordedGlucosePoints(scopeKey: string) {
  const store = await loadStore(scopeKey);
  return store.historyStore
    .filter(
      (point): point is MonitoringHistoryPoint & { glucoseMmol: number } =>
        point.glucoseSource === "recorded" && typeof point.glucoseMmol === "number" && Number.isFinite(point.glucoseMmol)
    )
    .map(clonePoint);
}
