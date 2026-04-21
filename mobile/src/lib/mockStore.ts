import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AdjustmentFeedback,
  ChatMessage,
  ChatSendPayload,
  ChatSendResult,
  ChatThread,
  DashboardFeedbackPayload,
  DashboardMetric,
  DashboardSnapshot,
  GlucoseForecastPoint,
  HealthProfile,
  MonitoringHistoryPoint,
  PlanAdjustment
} from "../types";
import { getShiftedDateString, getTodayString } from "./utils";

type FallbackStore = {
  profile: HealthProfile | null;
  historyStore: MonitoringHistoryPoint[];
  messagesByDate: Record<string, ChatMessage[]>;
  feedbackByDate: Record<string, AdjustmentFeedback>;
};

const FALLBACK_STORE_KEY_PREFIX = "health-track-mobile-fallback-store";

function getFallbackStoreKey(scopeKey: string) {
  return `${FALLBACK_STORE_KEY_PREFIX}:${scopeKey}`;
}

function createEmptyPoint(date: string): MonitoringHistoryPoint {
  return {
    date,
    calories: 0,
    exerciseMinutes: 0,
    steps: 0,
    sleepHours: 0,
    glucoseMmol: null,
    glucoseSource: null
  };
}

function createEmptyStore(): FallbackStore {
  return {
    profile: null,
    historyStore: [],
    messagesByDate: {},
    feedbackByDate: {}
  };
}

function clonePoint(point: MonitoringHistoryPoint): MonitoringHistoryPoint {
  return {
    ...point,
    glucoseMmol: typeof point.glucoseMmol === "number" ? point.glucoseMmol : null,
    glucoseSource: point.glucoseSource ?? null
  };
}

function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message
  };
}

function cloneProfile(profile: HealthProfile | null) {
  return profile ? { ...profile } : null;
}

function normalizeStore(value: unknown): FallbackStore {
  if (!value || typeof value !== "object") {
    return createEmptyStore();
  }

  const parsed = value as Partial<FallbackStore>;
  const historyStore = Array.isArray(parsed.historyStore) ? parsed.historyStore.map(clonePoint) : [];
  const messagesByDate = Object.fromEntries(
    Object.entries(parsed.messagesByDate ?? {}).map(([date, messages]) => [
      date,
      Array.isArray(messages) ? messages.map(cloneMessage) : []
    ])
  );
  const feedbackByDate = Object.fromEntries(
    Object.entries(parsed.feedbackByDate ?? {}).filter(([, feedback]) => feedback === "accept" || feedback === "reject" || feedback === null)
  ) as Record<string, AdjustmentFeedback>;

  return {
    profile: cloneProfile(parsed.profile ?? null),
    historyStore,
    messagesByDate,
    feedbackByDate
  };
}

async function loadStore(scopeKey: string) {
  const raw = await AsyncStorage.getItem(getFallbackStoreKey(scopeKey));

  if (!raw) {
    return createEmptyStore();
  }

  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    return createEmptyStore();
  }
}

async function saveStore(scopeKey: string, store: FallbackStore) {
  await AsyncStorage.setItem(getFallbackStoreKey(scopeKey), JSON.stringify(store));
}

async function updateStore<T>(scopeKey: string, updater: (store: FallbackStore) => T) {
  const store = await loadStore(scopeKey);
  const result = updater(store);
  await saveStore(scopeKey, store);
  return result;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getStoredPoint(store: FallbackStore, date: string) {
  return store.historyStore.find((item) => item.date === date);
}

function getPointForRead(store: FallbackStore, date: string) {
  return clonePoint(getStoredPoint(store, date) ?? createEmptyPoint(date));
}

function ensureMutablePoint(store: FallbackStore, date: string) {
  const existing = getStoredPoint(store, date);

  if (existing) {
    return existing;
  }

  const created = createEmptyPoint(date);
  store.historyStore = [...store.historyStore, created].sort((left, right) => left.date.localeCompare(right.date));
  return created;
}

function historyWindow(store: FallbackStore, focusDate: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = getShiftedDateString(focusDate, index - 6);
    return getPointForRead(store, date);
  });
}

function hasGlucoseValue(point: MonitoringHistoryPoint) {
  return typeof point.glucoseMmol === "number" && Number.isFinite(point.glucoseMmol);
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

function buildSnapshot(store: FallbackStore, date = getTodayString()): DashboardSnapshot {
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

function createThreadSeed(store: FallbackStore, date: string): ChatMessage[] {
  const nickname = store.profile?.nickname || "访客";
  const adjustment = buildAdjustment(getPointForRead(store, date), date, store.profile, store.feedbackByDate[date] ?? null);
  const createdAt = new Date().toISOString();

  return [
    {
      id: createId("assistant"),
      role: "assistant",
      content: `你好，${nickname}。这里会按当前身份单独保存你的饮食、运动、睡眠和血糖记录。`,
      createdAt
    },
    {
      id: createId("assistant"),
      role: "assistant",
      content: `当前建议：${adjustment.title}，${adjustment.parameterLabel} ${adjustment.parameterDelta}。${adjustment.summary}`,
      createdAt
    }
  ];
}

function ensureThread(store: FallbackStore, date: string) {
  if (!store.messagesByDate[date]) {
    store.messagesByDate[date] = createThreadSeed(store, date);
  }

  return store.messagesByDate[date];
}

function extractNumber(source: string, expression: RegExp) {
  const matched = source.match(expression);
  return matched ? Number(matched[1]) : undefined;
}

function applyMessageToPoint(point: MonitoringHistoryPoint, message: string) {
  const changes: string[] = [];
  const normalized = message.toLowerCase();

  const steps = extractNumber(message, /(\d+)\s*(?:步|steps?)/i);
  if (typeof steps === "number") {
    point.steps = steps;
    changes.push(`步数 ${steps}`);
  }

  const calories = extractNumber(message, /(\d+)\s*(?:kcal|千卡|卡路里)/i);
  if (typeof calories === "number") {
    const isTotal = /总共|全天|今天|摄入/.test(message);
    point.calories = isTotal ? calories : point.calories + calories;
    changes.push(`热量 ${point.calories} kcal`);
  }

  const glucose = extractNumber(message, /(?:血糖|glucose)[^\d]*(\d+(?:\.\d+)?)/i);
  if (typeof glucose === "number") {
    point.glucoseMmol = glucose;
    point.glucoseSource = "recorded";
    changes.push(`血糖 ${glucose.toFixed(1)} mmol/L`);
  }

  const sleep = extractNumber(message, /(\d+(?:\.\d+)?)\s*(?:小时|h)\b/i);
  if (typeof sleep === "number" && /睡|睡眠|入睡/.test(message)) {
    point.sleepHours = sleep;
    changes.push(`睡眠 ${sleep.toFixed(1)} h`);
  }

  const minutes = extractNumber(message, /(\d+)\s*(?:分钟|min)\b/i);
  if (typeof minutes === "number" && /(走路|慢跑|运动|训练|快走|步行)/i.test(normalized)) {
    const shouldAccumulate = /又|再|追加|补/.test(message);
    point.exerciseMinutes = shouldAccumulate ? point.exerciseMinutes + minutes : Math.max(point.exerciseMinutes, minutes);
    changes.push(`运动 ${point.exerciseMinutes} min`);
  }

  return changes;
}

export async function getFallbackHealthProfile(scopeKey: string) {
  const store = await loadStore(scopeKey);
  return cloneProfile(store.profile);
}

export async function saveFallbackHealthProfile(scopeKey: string, profile: HealthProfile) {
  return updateStore(scopeKey, (store) => {
    store.profile = {
      ...profile,
      updatedAt: new Date().toISOString()
    };

    return cloneProfile(store.profile)!;
  });
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

export async function getFallbackChatThread(scopeKey: string, date = getTodayString()): Promise<ChatThread> {
  return updateStore(scopeKey, (store) => ({
    focusDate: date,
    messages: ensureThread(store, date).map(cloneMessage),
    dataSource: "mock"
  }));
}

export async function submitFallbackDashboardFeedback(scopeKey: string, payload: DashboardFeedbackPayload) {
  const date = payload.focusDate ?? getTodayString();

  return updateStore(scopeKey, (store) => {
    store.feedbackByDate[date] = payload.feedback;

    ensureThread(store, date).push({
      id: createId("system"),
      role: "system",
      content:
        payload.feedback === "accept"
          ? "已记录“接受当前建议”。"
          : "已记录“当前建议不太合适”。",
      createdAt: new Date().toISOString()
    });

    return buildSnapshot(store, date);
  });
}

export async function sendFallbackChatMessage(scopeKey: string, payload: ChatSendPayload): Promise<ChatSendResult> {
  const date = payload.focusDate ?? getTodayString();

  return updateStore(scopeKey, (store) => {
    const thread = ensureThread(store, date);
    const point = ensureMutablePoint(store, date);
    const userMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      content: payload.message.trim(),
      createdAt: new Date().toISOString()
    };

    thread.push(userMessage);

    const changes = applyMessageToPoint(point, payload.message);
    store.feedbackByDate[date] = null;
    const snapshot = buildSnapshot(store, date);
    const assistantMessage: ChatMessage = {
      id: createId("assistant"),
      role: "assistant",
      content:
        changes.length > 0
          ? `已写入今日记录：${changes.join("，")}。当前建议调整为 ${snapshot.adjustment.title}，${snapshot.adjustment.parameterLabel} ${snapshot.adjustment.parameterDelta}。${snapshot.adjustment.summary}`
          : `已收到这条${payload.inputMode === "voice" ? "语音" : "文本"}描述，但暂时没有识别到明确数值。我先归档为行为事件。`,
      createdAt: new Date().toISOString()
    };

    thread.push(assistantMessage);

    return {
      focusDate: date,
      messages: thread.map(cloneMessage),
      dashboard: snapshot,
      dataSource: "mock"
    };
  });
}
