import { useEffect, useRef, useState } from "react";
import { chatApi } from "../api/chatApi";
import {
  LOADING_STAGE_DELAYS_MS,
  createLocalId,
  getFailureCopy,
  pickLoadingCopy,
  resolveErrorKind,
  toUiMessage,
  type MessageErrorKind,
  type UIChatMessage
} from "../model/chatMessageUi";
import { isAuthExpiredError } from "../../../shared/api/client";
import { getTodayString } from "../../../lib/utils";
import type { ChatSendPayload, ChatSendResult } from "../../../types";

type UseChatThreadStateParams = {
  healthProfileUpdatedAt?: string;
  onConversationCommitted: () => void;
  scrollToBottom: (animated?: boolean) => void;
  sessionUserId?: number | string;
};

export function useChatThreadState({
  healthProfileUpdatedAt,
  onConversationCommitted,
  scrollToBottom,
  sessionUserId
}: UseChatThreadStateParams) {
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [dataSource, setDataSource] = useState<"server" | "mock">("mock");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [capabilityNote, setCapabilityNote] = useState("");
  const messagesRef = useRef<UIChatMessage[]>([]);
  const loadingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function updateMessages(nextValue: UIChatMessage[] | ((current: UIChatMessage[]) => UIChatMessage[])) {
    setMessages((current) => {
      const next =
        typeof nextValue === "function" ? (nextValue as (current: UIChatMessage[]) => UIChatMessage[])(current) : nextValue;
      messagesRef.current = next;
      return next;
    });
  }

  function clearLoadingTimers() {
    loadingTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    loadingTimersRef.current = [];
  }

  function startLoadingFeedback(placeholderId: string, seed: number) {
    clearLoadingTimers();
    updateMessages((current) =>
      current.map((message) =>
        message.id === placeholderId && message.uiState === "loading"
          ? {
              ...message,
              content: pickLoadingCopy(0, seed)
            }
          : message
      )
    );

    loadingTimersRef.current = LOADING_STAGE_DELAYS_MS.map((delay, stageIndex) =>
      setTimeout(() => {
        updateMessages((current) =>
          current.map((message) =>
            message.id === placeholderId && message.uiState === "loading"
              ? {
                  ...message,
                  content: pickLoadingCopy(stageIndex + 1, seed)
                }
              : message
          )
        );
      }, delay)
    );
  }

  async function loadThread() {
    try {
      const thread = await chatApi.getChatThread(getTodayString());
      updateMessages(thread.messages.map(toUiMessage));
      setDataSource(thread.dataSource);
      scrollToBottom(false);
    } catch (error) {
      if (!isAuthExpiredError(error)) {
        throw error;
      }
    }
  }

  function replacePlaceholderWithError(
    placeholderId: string,
    payload: ChatSendPayload,
    linkedUserMessageId: string,
    errorKind: MessageErrorKind
  ) {
    const failedAt = new Date().toISOString();

    updateMessages((current) =>
      current.map((message) =>
        message.id === placeholderId
          ? {
              ...message,
              content: getFailureCopy(errorKind),
              createdAt: failedAt,
              errorKind,
              linkedUserMessageId,
              optimistic: true,
              retryPayload: payload,
              uiState: "error"
            }
          : message
      )
    );
  }

  function reconcileSuccessfulSend(result: ChatSendResult, userMessageId: string, placeholderId: string) {
    const committedCount = messagesRef.current.filter((message) => !message.optimistic).length;
    const serverDelta = result.messages.slice(committedCount);
    const serverUser = serverDelta.find((message) => message.role === "user");
    const serverAssistant = [...serverDelta].reverse().find((message) => message.role === "assistant");

    if (!serverUser || !serverAssistant) {
      void loadThread();
      return;
    }

    const extraMessages = serverDelta.filter((message) => message !== serverUser && message !== serverAssistant).map(toUiMessage);

    updateMessages((current) => {
      const replaced = current.map((message) => {
        if (message.id === userMessageId) {
          return {
            ...serverUser,
            id: message.id
          };
        }

        if (message.id === placeholderId) {
          return {
            ...serverAssistant,
            id: message.id
          };
        }

        return message;
      });

      if (extraMessages.length === 0) {
        return replaced;
      }

      const placeholderIndex = replaced.findIndex((message) => message.id === placeholderId);
      if (placeholderIndex === -1) {
        return [...replaced, ...extraMessages];
      }

      return [
        ...replaced.slice(0, placeholderIndex + 1),
        ...extraMessages,
        ...replaced.slice(placeholderIndex + 1)
      ];
    });
  }

  async function submitMessage(
    payload: ChatSendPayload,
    options: {
      placeholderId: string;
      seed: number;
      userMessageId: string;
    }
  ) {
    setSending(true);
    startLoadingFeedback(options.placeholderId, options.seed);

    try {
      const result = await chatApi.sendChatMessage(payload);
      clearLoadingTimers();

      reconcileSuccessfulSend(result, options.userMessageId, options.placeholderId);
      setDataSource(result.dataSource);
      onConversationCommitted();
      scrollToBottom();
    } catch (error) {
      clearLoadingTimers();

      replacePlaceholderWithError(options.placeholderId, payload, options.userMessageId, resolveErrorKind(error));
      scrollToBottom();
    } finally {
      setSending(false);
    }
  }

  async function handleRetry(messageId: string) {
    if (sending) {
      return;
    }

    const failedMessage = messagesRef.current.find((message) => message.id === messageId);

    if (!failedMessage?.retryPayload || !failedMessage.linkedUserMessageId) {
      return;
    }

    const seed = Date.now();
    setCapabilityNote("");

    updateMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: pickLoadingCopy(0, seed),
              createdAt: new Date().toISOString(),
              errorKind: undefined,
              uiState: "loading"
            }
          : message
      )
    );

    scrollToBottom(false);

    await submitMessage(failedMessage.retryPayload, {
      placeholderId: messageId,
      seed,
      userMessageId: failedMessage.linkedUserMessageId
    });
  }

  async function handleSend(inputMode: "text" | "voice" = "text") {
    const content = draft.trim();

    if (!content) {
      if (inputMode === "voice") {
        setCapabilityNote("语音入口已预留，接入录音与转写后会直接发送到今天的对话中。");
      }

      return;
    }

    if (sending) {
      return;
    }

    if (messagesRef.current.some((message) => message.uiState === "error")) {
      return;
    }

    const focusDate = getTodayString();
    const seed = Date.now();
    const createdAt = new Date().toISOString();
    const userMessageId = createLocalId("user");
    const placeholderId = createLocalId("assistant");
    const payload: ChatSendPayload = {
      focusDate,
      inputMode,
      message: content
    };

    updateMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content,
        createdAt,
        optimistic: true
      },
      {
        id: placeholderId,
        role: "assistant",
        content: pickLoadingCopy(0, seed),
        createdAt,
        linkedUserMessageId: userMessageId,
        optimistic: true,
        retryPayload: payload,
        uiState: "loading"
      }
    ]);

    setDraft("");
    setCapabilityNote(
      inputMode === "voice" ? "当前会沿用文本提交通道，后续可替换为真实录音与转写上传。" : ""
    );
    scrollToBottom();

    await submitMessage(payload, {
      placeholderId,
      seed,
      userMessageId
    });
  }

  useEffect(() => {
    void loadThread();
  }, [healthProfileUpdatedAt, sessionUserId]);

  useEffect(() => {
    return () => {
      clearLoadingTimers();
    };
  }, []);

  const hasRetryableMessage = messages.some((message) => message.uiState === "error");
  const composerNote = sending
    ? "AI 正在处理中，回复生成后会自动更新在对话中。"
    : hasRetryableMessage
      ? "上一条消息尚未完成，可直接在对话气泡中点击“重试”。"
      : capabilityNote;
  const threadHint =
    dataSource === "server" ? "当前展示的是账号专属对话记录" : "当前展示的是本地身份空间中的对话记录";

  return {
    composerNote,
    draft,
    handleRetry,
    handleSend,
    messages,
    sendButtonDisabled: sending || hasRetryableMessage || !draft.trim(),
    sending,
    setDraft,
    threadHint,
    voiceButtonDisabled: sending || hasRetryableMessage
  };
}
