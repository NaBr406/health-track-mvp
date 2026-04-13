import type {
  AdjustmentFeedback,
  ChatThread,
  ChatMessage,
  ChatSendPayload,
  ChatSendResult,
  DashboardFeedbackPayload,
  DashboardMetric,
  DashboardSnapshot,
  HealthProfile,
  MonitoringHistoryPoint,
  PlanAdjustment
} from "../types";
import { mockHealthProfile, mockMonitoringHistory } from "./mock";
import { getShiftedDateString, getTodayString, parseLeadingNumber } from "./utils";

let profileStore: HealthProfile = { ...mockHealthProfile };
let historyStore: MonitoringHistoryPoint[] = mockMonitoringHistory.map((item) => ({ ...item }));
const messagesByDate: Record<string, ChatMessage[]> = {};
const feedbackByDate: Record<string, AdjustmentFeedback> = {};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensurePoint(date: string) {
  const existing = historyStore.find((item) => item.date === date);

  if (existing) {
    return existing;
  }

  const created: MonitoringHistoryPoint = {
    date,
    calories: 0,
    exerciseMinutes: 0,
    steps: 0,
    sleepHours: 0,
    glucoseMmol: parseLeadingNumber(profileStore.fastingGlucoseBaseline) ?? 7.2
  };

  historyStore = [...historyStore, created].sort((left, right) => left.date.localeCompare(right.date));
  return created;
}

function historyWindow(focusDate: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = getShiftedDateString(focusDate, index - 6);
    return { ...ensurePoint(date) };
  });
}

function buildAdjustment(point: MonitoringHistoryPoint, date: string): PlanAdjustment {
  const glucose = point.glucoseMmol;
  const feedback = feedbackByDate[date] ?? null;
  let title = "维持当前方案";
  let parameterLabel = "CHO";
  let parameterDelta = "-10 g";
  let summary = "当前波动仍集中在餐后与久坐窗口，继续维持少量减碳与餐后步行。";

  if (glucose >= 8) {
    title = "抑制餐后波动";
    parameterDelta = "-18 g";
    summary = "午后主食建议小幅下调，并把零食窗口后移到运动恢复后。";
  } else if (point.steps < 5000) {
    title = "补齐活动量";
    parameterLabel = "ACT";
    parameterDelta = "+12 min";
    summary = "优先追加一次低强度步行，把活动量从低位拉回稳定区间。";
  } else if (point.sleepHours < 6.5) {
    title = "修复恢复窗口";
    parameterLabel = "SLEEP";
    parameterDelta = "+0.5 h";
    summary = "今晚优先锁定睡前流程，减少额外刺激，避免次日血糖对睡眠债过度敏感。";
  }

  return {
    id: `adjustment-${date}`,
    title,
    summary,
    parameterLabel,
    parameterDelta,
    rationale: `基于 ${profileStore.conditionLabel}、今日血糖 ${glucose.toFixed(1)} mmol/L、步数 ${point.steps} 步推演。`,
    generatedAt: new Date().toISOString(),
    feedback
  };
}

function buildMetrics(point: MonitoringHistoryPoint): DashboardMetric[] {
  return [
    {
      id: "glucose",
      label: "血糖",
      value: point.glucoseMmol.toFixed(1),
      unit: "mmol/L",
      descriptor: "餐后波动监测",
      source: "RAG / 会话解析"
    },
    {
      id: "calories",
      label: "热量",
      value: `${point.calories}`,
      unit: "kcal",
      descriptor: "今日总摄入",
      source: "对话归档"
    },
    {
      id: "steps",
      label: "步数",
      value: `${point.steps}`,
      unit: "步",
      descriptor: "低强度活动",
      source: "行为解析"
    },
    {
      id: "exercise",
      label: "运动",
      value: `${point.exerciseMinutes}`,
      unit: "min",
      descriptor: "主动训练时长",
      source: "行为解析"
    },
    {
      id: "sleep",
      label: "睡眠",
      value: point.sleepHours.toFixed(1),
      unit: "h",
      descriptor: "恢复窗口",
      source: "夜间回顾"
    }
  ];
}

function buildObservation(point: MonitoringHistoryPoint) {
  if (point.glucoseMmol >= 8) {
    return "系统判定今日主要风险来自餐后峰值，应优先压缩碳水并增加餐后轻步行。";
  }

  if (point.sleepHours < 6.5) {
    return "系统判定今日主要风险来自恢复不足，夜间节律比额外训练更值得优先修复。";
  }

  if (point.steps < 5000) {
    return "系统判定今日主要风险来自久坐与低活动量，建议把活动补齐而不是继续追加摄入限制。";
  }

  return "系统判定今日处于可控区间，方案重点是稳定执行与减少无谓波动。";
}

function buildHeadline() {
  return `今日方案围绕 ${profileStore.conditionLabel} 稳定控制展开，重点盯住餐后波动、活动缺口与恢复质量。`;
}

function buildSnapshot(date = getTodayString()): DashboardSnapshot {
  const point = ensurePoint(date);

  return {
    focusDate: date,
    headline: buildHeadline(),
    adjustment: buildAdjustment(point, date),
    metrics: buildMetrics(point),
    observation: buildObservation(point),
    refreshedAt: new Date().toISOString(),
    history: historyWindow(date),
    dataSource: "mock"
  };
}

function createThreadSeed(date: string): ChatMessage[] {
  const adjustment = buildAdjustment(ensurePoint(date), date);
  const createdAt = new Date().toISOString();

  return [
    {
      id: createId("assistant"),
      role: "assistant",
      content: `你好，${profileStore.nickname}。从现在起，每日行为日志只在这里归档。你可以像聊天一样直接说“午餐米饭减半，晚饭后走了 4200 步，血糖 7.6”。`,
      createdAt
    },
    {
      id: createId("assistant"),
      role: "assistant",
      content: `今日微调建议：${adjustment.title}，${adjustment.parameterLabel} ${adjustment.parameterDelta}。${adjustment.summary}`,
      createdAt
    }
  ];
}

function ensureThread(date: string) {
  if (!messagesByDate[date]) {
    messagesByDate[date] = createThreadSeed(date);
  }

  return messagesByDate[date];
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

  const calories = extractNumber(message, /(\d+)\s*(?:kcal|千卡|卡路里|卡)\b/i);
  if (typeof calories === "number") {
    const isTotal = /总共|全天|今天|摄入/.test(message);
    point.calories = isTotal ? calories : point.calories + calories;
    changes.push(`热量 ${point.calories} kcal`);
  }

  const glucose = extractNumber(message, /血糖[^\d]*(\d+(?:\.\d+)?)/i);
  if (typeof glucose === "number") {
    point.glucoseMmol = glucose;
    changes.push(`血糖 ${glucose.toFixed(1)} mmol/L`);
  }

  const sleep = extractNumber(message, /(\d+(?:\.\d+)?)\s*(?:小时|h)\b/i);
  if (typeof sleep === "number" && /睡|睡眠|入睡/.test(message)) {
    point.sleepHours = sleep;
    changes.push(`睡眠 ${sleep.toFixed(1)} h`);
  }

  const minutes = extractNumber(message, /(\d+)\s*(?:分钟|分)\b/i);
  if (typeof minutes === "number" && /(走|跑|骑|运动|训练|快走|步行)/i.test(normalized)) {
    const shouldAccumulate = /又|再|追加|补/.test(message);
    point.exerciseMinutes = shouldAccumulate ? point.exerciseMinutes + minutes : Math.max(point.exerciseMinutes, minutes);
    changes.push(`运动 ${point.exerciseMinutes} min`);
  }

  return changes;
}

export function hydrateFallbackProfile(profile?: HealthProfile | null) {
  if (!profile) {
    return;
  }

  profileStore = { ...profile };
}

export function getFallbackHealthProfile() {
  return { ...profileStore };
}

export function saveFallbackHealthProfile(profile: HealthProfile) {
  profileStore = { ...profile, updatedAt: new Date().toISOString() };
  return getFallbackHealthProfile();
}

export function getFallbackDashboardSnapshot(date = getTodayString()) {
  return buildSnapshot(date);
}

export function getFallbackChatThread(date = getTodayString()): ChatThread {
  return {
    focusDate: date,
    messages: [...ensureThread(date)],
    dataSource: "mock"
  };
}

export function submitFallbackDashboardFeedback(payload: DashboardFeedbackPayload) {
  const date = payload.focusDate ?? getTodayString();
  feedbackByDate[date] = payload.feedback;

  ensureThread(date).push({
    id: createId("system"),
    role: "system",
    content:
      payload.feedback === "accept"
        ? "已记录“采纳并执行”。系统会把这条反馈送往后端校准链路。"
        : "已记录“记录偏差”。系统会把这条反馈送往后端校准链路。",
    createdAt: new Date().toISOString()
  });

  return buildSnapshot(date);
}

export function sendFallbackChatMessage(payload: ChatSendPayload): ChatSendResult {
  const date = payload.focusDate ?? getTodayString();
  const thread = ensureThread(date);
  const point = ensurePoint(date);
  const userMessage: ChatMessage = {
    id: createId("user"),
    role: "user",
    content: payload.message.trim(),
    createdAt: new Date().toISOString()
  };

  thread.push(userMessage);

  const changes = applyMessageToPoint(point, payload.message);
  feedbackByDate[date] = null;
  const snapshot = buildSnapshot(date);
  const assistantMessage: ChatMessage = {
    id: createId("assistant"),
    role: "assistant",
    content:
      changes.length > 0
        ? `已写入今日行为日志：${changes.join("，")}。新的微调为 ${snapshot.adjustment.title}，${snapshot.adjustment.parameterLabel} ${snapshot.adjustment.parameterDelta}。${snapshot.adjustment.summary}`
        : `已收到这条${payload.inputMode === "voice" ? "语音" : "文本"}描述，但暂未识别到明确数值。我先归档为行为事件，当前微调保持为 ${snapshot.adjustment.title}。`,
    createdAt: new Date().toISOString()
  };

  thread.push(assistantMessage);

  return {
    focusDate: date,
    messages: [...thread],
    dashboard: snapshot,
    dataSource: "mock"
  };
}
