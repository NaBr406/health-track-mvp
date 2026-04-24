import type { ChatMessage, ChatSendPayload, ChatSendResult, ChatThread, DashboardFeedbackPayload, MonitoringHistoryPoint } from "../../types";
import { getTodayString } from "../utils";
import { buildSnapshot } from "./fallbackStoreSnapshot";
import {
  type FallbackStore,
  cloneMessage,
  createId,
  ensureMutablePoint,
  updateStore
} from "./fallbackStoreCore";

function createThreadSeed(store: FallbackStore, date: string): ChatMessage[] {
  const nickname = store.profile?.nickname || "访客";
  const adjustment = buildSnapshot(store, date).adjustment;
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
  // 用轻量文本提取维持游客模式可用性，即使没有服务端解析也能形成基础数据。

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
