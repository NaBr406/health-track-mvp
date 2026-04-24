import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { chatApi } from "../api/chatApi";
import { ChatComposer } from "../components/ChatComposer";
import { ChatMessageBubble } from "../components/ChatMessageBubble";
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
import { useImmersiveTabBarScroll } from "../../../navigation/ImmersiveTabBarContext";
import { borders, colors, layout, spacing, typography } from "../../../theme/tokens";
import type { AuthSession, ChatSendPayload, ChatSendResult, HealthProfile } from "../../../types";

type AIChatScreenProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  onConversationCommitted: () => void;
  onRequestSignIn: () => void;
};

export function AIChatScreen({
  session,
  healthProfile,
  onConversationCommitted,
  onRequestSignIn
}: AIChatScreenProps) {
  const KeyboardContainer = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const [messages, setMessages] = useState<UIChatMessage[]>([]);
  const [dataSource, setDataSource] = useState<"server" | "mock">("mock");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [capabilityNote, setCapabilityNote] = useState("");
  const listRef = useRef<FlatList<UIChatMessage>>(null);
  const messagesRef = useRef<UIChatMessage[]>([]);
  const loadingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const insets = useSafeAreaInsets();
  const { bottomInset, hidden, onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle } = useImmersiveTabBarScroll();
  const baselineLayoutHeightRef = useRef(0);
  const composerLiftAnimation = useRef(new Animated.Value(0)).current;

  function updateMessages(nextValue: UIChatMessage[] | ((current: UIChatMessage[]) => UIChatMessage[])) {
    setMessages((current) => {
      const next =
        typeof nextValue === "function" ? (nextValue as (current: UIChatMessage[]) => UIChatMessage[])(current) : nextValue;
      messagesRef.current = next;
      return next;
    });
  }

  function scrollToBottom(animated = true) {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }

  function handleComposerFocus() {
    scrollToBottom(false);
  }

  function handleLayout(nextHeight: number) {
    setLayoutHeight((current) => (current === nextHeight ? current : nextHeight));

    if (!keyboardVisible || nextHeight > baselineLayoutHeightRef.current) {
      baselineLayoutHeightRef.current = nextHeight;
    }
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
  }, [healthProfile?.updatedAt, session?.userId]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (event) => {
      const screenHeight = Dimensions.get("screen").height;
      const nextKeyboardHeight = Math.max(event.endCoordinates.height, Math.max(0, screenHeight - event.endCoordinates.screenY));

      setKeyboardVisible(true);
      setKeyboardHeight(nextKeyboardHeight);
      scrollToBottom(false);
    });
    const hideSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!keyboardVisible && layoutHeight > 0) {
      baselineLayoutHeightRef.current = layoutHeight;
    }
  }, [keyboardVisible, layoutHeight]);

  useEffect(() => {
    const hiddenComposerFloor = Math.max(insets.bottom, spacing.sm);
    const composerPaddingBottom = Platform.OS === "ios" ? Math.max(insets.bottom, spacing.xs) : spacing.xs;
    const visibleComposerMarginBottom = bottomInset > 0 ? bottomInset - composerPaddingBottom : hiddenComposerFloor;
    const baseComposerMarginBottom = hidden ? hiddenComposerFloor : visibleComposerMarginBottom;
    const resizedKeyboardInset =
      Platform.OS === "android" && keyboardVisible
        ? Math.max(0, baselineLayoutHeightRef.current - layoutHeight)
        : 0;
    const targetComposerLift =
      Platform.OS === "android" && keyboardVisible
        ? Math.max(0, keyboardHeight - resizedKeyboardInset - baseComposerMarginBottom)
        : 0;

    composerLiftAnimation.stopAnimation();
    Animated.timing(composerLiftAnimation, {
      duration: keyboardVisible ? 160 : 120,
      easing: Easing.out(Easing.cubic),
      toValue: targetComposerLift,
      useNativeDriver: true
    }).start();
  }, [bottomInset, composerLiftAnimation, hidden, insets.bottom, keyboardHeight, keyboardVisible, layoutHeight]);

  useEffect(() => {
    return () => {
      clearLoadingTimers();
    };
  }, []);

  const threadHint =
    dataSource === "server" ? "当前展示的是账号专属对话记录" : "当前展示的是本地身份空间中的对话记录";
  const hasRetryableMessage = messages.some((message) => message.uiState === "error");
  const composerNote = sending
    ? "AI 正在处理中，回复生成后会自动更新在对话中。"
    : hasRetryableMessage
      ? "上一条消息尚未完成，可直接在对话气泡中点击“重试”。"
      : capabilityNote;
  const voiceButtonDisabled = sending || hasRetryableMessage;
  const sendButtonDisabled = sending || hasRetryableMessage || !draft.trim();
  const hiddenComposerFloor = Math.max(insets.bottom, spacing.sm);
  const composerPaddingBottom = Platform.OS === "ios" ? Math.max(insets.bottom, spacing.xs) : spacing.xs;
  const visibleComposerMarginBottom = bottomInset > 0 ? bottomInset - composerPaddingBottom : hiddenComposerFloor;
  const composerMarginBottom = hidden ? hiddenComposerFloor : visibleComposerMarginBottom;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <KeyboardContainer
        {...(Platform.OS === "ios"
          ? {
              behavior: "padding" as const,
              keyboardVerticalOffset: 8
            }
          : {})}
        style={styles.flex}
      >
        <View
          onLayout={(event) => handleLayout(event.nativeEvent.layout.height)}
          style={styles.flex}
        >
          <FlatList
            contentContainerStyle={styles.listContent}
            data={messages}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            ListHeaderComponent={<Text style={styles.threadHint}>{threadHint}</Text>}
            onScroll={onScroll}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            ref={listRef}
            renderItem={({ item }) => (
              <ChatMessageBubble
                message={item}
                onRetry={(messageId) => void handleRetry(messageId)}
              />
            )}
            scrollEventThrottle={scrollEventThrottle}
            showsVerticalScrollIndicator={false}
          />

          <Animated.View
            style={[
              styles.composer,
              {
                marginBottom: composerMarginBottom,
                paddingBottom: composerPaddingBottom,
                transform: [
                  {
                    translateY: Animated.multiply(composerLiftAnimation, -1)
                  }
                ]
              }
            ]}
          >
            <ChatComposer
              draft={draft}
              note={composerNote}
              onChangeDraft={setDraft}
              onFocus={handleComposerFocus}
              onRequestSignIn={onRequestSignIn}
              onSendText={() => void handleSend("text")}
              onSendVoice={() => void handleSend("voice")}
              sendButtonDisabled={sendButtonDisabled}
              sending={sending}
              showGuestPrompt={!session}
              voiceButtonDisabled={voiceButtonDisabled}
            />
          </Animated.View>
        </View>
      </KeyboardContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  flex: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  threadHint: {
    alignSelf: "center",
    color: colors.textSoft,
    fontSize: typography.caption,
    marginBottom: spacing.sm
  },
  composer: {
    borderTopWidth: borders.standard,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: spacing.sm,
    gap: spacing.sm
  }
});
