import { getFallbackChatThread, sendFallbackChatMessage } from "../../../lib/mockStore";
import { buildQuery, request } from "../../../shared/api/client";
import { resolveIdentity } from "../../../shared/api/identity";
import type { ChatSendPayload, ChatSendResult, ChatThread } from "../../../types";

async function getChatThread(date?: string) {
  const identity = await resolveIdentity();

  if (!identity.session) {
    return getFallbackChatThread(identity.scopeKey, date);
  }

  return request<ChatThread>(`/api/interaction/thread${buildQuery({ date })}`, {}, () => getFallbackChatThread(identity.scopeKey, date));
}

async function sendChatMessage(payload: ChatSendPayload) {
  const identity = await resolveIdentity();

  if (!identity.session) {
    return sendFallbackChatMessage(identity.scopeKey, payload);
  }

  return request<ChatSendResult>("/api/interaction/messages", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export const chatApi = {
  getChatThread,
  sendChatMessage
};
