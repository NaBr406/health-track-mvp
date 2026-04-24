import { formatTime } from "../../../lib/utils";
import type { ChatMessage, ChatSendPayload } from "../../../types";

export type MessageUiState = "loading" | "error";
export type MessageErrorKind = "network" | "timeout" | "server";

export type UIChatMessage = ChatMessage & {
  optimistic?: boolean;
  uiState?: MessageUiState;
  errorKind?: MessageErrorKind;
  retryPayload?: ChatSendPayload;
  linkedUserMessageId?: string;
};

export const LOADING_STAGE_DELAYS_MS = [2000, 5000, 9000] as const;

const LOADING_STAGE_VARIANTS = [
  ["正在思考...", "正在理解你的问题..."],
  ["正在分析你的问题...", "正在结合你的记录进行分析..."],
  ["正在整理健康建议...", "正在生成回复..."],
  ["正在深入分析，请再稍等片刻...", "当前请求稍慢，正在继续生成..."]
] as const;

export function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toUiMessage(message: ChatMessage): UIChatMessage {
  return {
    ...message
  };
}

export function pickLoadingCopy(stage: number, seed: number) {
  const variants = LOADING_STAGE_VARIANTS[Math.min(stage, LOADING_STAGE_VARIANTS.length - 1)];
  return variants[seed % variants.length];
}

export function resolveErrorKind(error: unknown): MessageErrorKind {
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (
      normalized.includes("network") ||
      normalized.includes("failed to fetch") ||
      normalized.includes("load failed") ||
      normalized.includes("network request failed")
    ) {
      return "network";
    }
  }

  return "server";
}

export function getFailureCopy(errorKind: MessageErrorKind) {
  if (errorKind === "network") {
    return "网络连接似乎不稳定，本次消息还没有发送成功。请检查网络后重试。";
  }

  if (errorKind === "timeout") {
    return "这次回复耗时较长，系统已停止等待。你可以重试，或稍后再发一次。";
  }

  return "当前回复生成失败，请稍后重试。";
}

export function buildMessageMeta(message: UIChatMessage) {
  if (message.uiState === "loading") {
    return "正在处理";
  }

  if (message.uiState === "error") {
    return `等待重试 | ${formatTime(message.createdAt)}`;
  }

  return formatTime(message.createdAt);
}
