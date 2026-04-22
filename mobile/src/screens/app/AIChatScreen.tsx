import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api, isAuthExpiredError } from "../../lib/api";
import { formatTime, getTodayString } from "../../lib/utils";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
import { borders, colors, layout, radii, spacing, typography } from "../../theme/tokens";
import type { AuthSession, ChatMessage, ChatSendPayload, ChatSendResult, HealthProfile } from "../../types";

type AIChatScreenProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  onConversationCommitted: () => void;
  onRequestSignIn: () => void;
};

type MessageUiState = "loading" | "error";
type MessageErrorKind = "network" | "timeout" | "server";

type UIChatMessage = ChatMessage & {
  optimistic?: boolean;
  uiState?: MessageUiState;
  errorKind?: MessageErrorKind;
  retryPayload?: ChatSendPayload;
  linkedUserMessageId?: string;
};

const LOADING_STAGE_DELAYS_MS = [2000, 5000, 9000] as const;
const LOADING_STAGE_VARIANTS = [
  ["正在思考...", "正在理解你的问题..."],
  ["正在分析你的问题...", "正在结合你的记录进行分析..."],
  ["正在整理健康建议...", "正在生成回复..."],
  ["正在深入分析，请再稍等片刻...", "当前请求稍慢，正在继续生成..."]
] as const;

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toUiMessage(message: ChatMessage): UIChatMessage {
  return {
    ...message
  };
}

function pickLoadingCopy(stage: number, seed: number) {
  const variants = LOADING_STAGE_VARIANTS[Math.min(stage, LOADING_STAGE_VARIANTS.length - 1)];
  return variants[seed % variants.length];
}

function resolveErrorKind(error: unknown): MessageErrorKind {
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

function getFailureCopy(errorKind: MessageErrorKind) {
  if (errorKind === "network") {
    return "网络连接似乎不稳定，本次消息还没有发送成功。请检查网络后重试。";
  }

  if (errorKind === "timeout") {
    return "这次回复耗时较长，系统已停止等待。你可以重试，或稍后再发一次。";
  }

  return "当前回复生成失败，请稍后重试。";
}

function buildMessageMeta(message: UIChatMessage) {
  if (message.uiState === "loading") {
    return "正在处理";
  }

  if (message.uiState === "error") {
    return `等待重试 | ${formatTime(message.createdAt)}`;
  }

  return formatTime(message.createdAt);
}

function LoadingDots() {
  const dotAnimations = useRef([
    new Animated.Value(0.35),
    new Animated.Value(0.35),
    new Animated.Value(0.35)
  ]).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.stagger(
        180,
        dotAnimations.map((value) =>
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: 280,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true
            }),
            Animated.timing(value, {
              toValue: 0.35,
              duration: 280,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true
            })
          ])
        )
      )
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [dotAnimations]);

  return (
    <View style={styles.loadingDotsRow}>
      {dotAnimations.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.loadingDot,
            {
              opacity: value,
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0, -2]
                  })
                }
              ]
            }
          ]}
        />
      ))}
    </View>
  );
}

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
      const thread = await api.getChatThread(getTodayString());
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
      const result = await api.sendChatMessage(payload);
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
            renderItem={({ item }) => {
              const isLoading = item.uiState === "loading";
              const isError = item.uiState === "error";

              return (
                <View
                  style={[
                    styles.messageRow,
                    item.role === "user" ? styles.messageRowUser : item.role === "system" ? styles.messageRowSystem : null
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      item.role === "user"
                        ? styles.messageBubbleUser
                        : item.role === "system"
                          ? styles.messageBubbleSystem
                          : styles.messageBubbleAssistant,
                      isLoading ? styles.messageBubbleLoading : null,
                      isError ? styles.messageBubbleError : null
                    ]}
                  >
                    {isError ? (
                      <View style={styles.stateLabelRow}>
                        <Ionicons
                          color={colors.danger}
                          name="alert-circle-outline"
                          size={14}
                        />
                        <Text style={[styles.stateLabel, styles.stateLabelError]}>回复未完成</Text>
                      </View>
                    ) : null}

                    <Text
                      style={[
                        styles.messageText,
                        item.role === "user" ? styles.messageTextUser : item.role === "system" ? styles.messageTextSystem : null,
                        isLoading ? styles.messageTextLoading : null
                      ]}
                    >
                      {item.content}
                    </Text>

                    {isLoading ? <LoadingDots /> : null}

                    {isError && item.retryPayload ? (
                      <Pressable
                        accessibilityLabel="重试发送"
                        accessibilityRole="button"
                        onPress={() => void handleRetry(item.id)}
                        style={({ pressed }) => [styles.retryButton, pressed ? styles.iconButtonPressed : null]}
                      >
                        <Ionicons color={colors.danger} name="refresh-outline" size={16} />
                        <Text style={styles.retryButtonText}>重试</Text>
                      </Pressable>
                    ) : null}

                    <Text
                      style={[
                        styles.messageMeta,
                        isLoading ? styles.messageMetaLoading : null,
                        isError ? styles.messageMetaError : null
                      ]}
                    >
                      {buildMessageMeta(item)}
                    </Text>
                  </View>
                </View>
              );
            }}
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
            {composerNote ? <Text style={styles.capabilityNote}>{composerNote}</Text> : null}

            {!session ? (
              <View style={styles.guestRow}>
                <Text style={styles.guestText}>游客模式也能继续记录；登录后会自动切换到该账号自己的数据空间。</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onRequestSignIn}
                  style={({ pressed }) => [styles.guestLink, pressed ? styles.iconButtonPressed : null]}
                >
                  <Text style={styles.guestLinkText}>登录账号</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.composerRow}>
              <TextInput
                blurOnSubmit={false}
                onChangeText={setDraft}
                onFocus={handleComposerFocus}
                onSubmitEditing={() => void handleSend("text")}
                placeholder="描述今天的饮食、运动、睡眠或身体变化..."
                placeholderTextColor={colors.textSoft}
                returnKeyType="send"
                style={styles.input}
                value={draft}
              />

              <Pressable
                accessibilityLabel="语音输入"
                accessibilityRole="button"
                disabled={voiceButtonDisabled}
                onPress={() => void handleSend("voice")}
                style={({ pressed }) => [
                  styles.iconButton,
                  styles.iconButtonSecondary,
                  voiceButtonDisabled ? styles.iconButtonDisabled : null,
                  pressed && !voiceButtonDisabled ? styles.iconButtonPressed : null
                ]}
              >
                <Ionicons color={voiceButtonDisabled ? colors.textSoft : colors.primary} name="mic-outline" size={20} />
              </Pressable>

              <Pressable
                accessibilityLabel={sending ? "正在发送" : "发送消息"}
                accessibilityRole="button"
                disabled={sendButtonDisabled}
                onPress={() => void handleSend("text")}
                style={({ pressed }) => [
                  styles.iconButton,
                  sending ? styles.iconButtonLoading : styles.iconButtonPrimary,
                  sendButtonDisabled ? styles.iconButtonDisabled : null,
                  pressed && !sendButtonDisabled ? styles.iconButtonPressed : null
                ]}
              >
                <Ionicons
                  color={sending ? colors.primary : colors.inverseText}
                  name={sending ? "time-outline" : "arrow-up"}
                  size={20}
                />
              </Pressable>
            </View>
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
  messageRow: {
    alignItems: "flex-start"
  },
  messageRowUser: {
    alignItems: "flex-end"
  },
  messageRowSystem: {
    alignItems: "center"
  },
  messageBubble: {
    maxWidth: "86%",
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm
  },
  messageBubbleAssistant: {
    backgroundColor: colors.surface
  },
  messageBubbleLoading: {
    backgroundColor: colors.surface,
    borderColor: colors.divider
  },
  messageBubbleError: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(197, 61, 61, 0.18)"
  },
  messageBubbleUser: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(0, 82, 204, 0.14)"
  },
  messageBubbleSystem: {
    backgroundColor: colors.surface
  },
  stateLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  stateLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  stateLabelError: {
    color: colors.danger
  },
  messageText: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    lineHeight: 26
  },
  messageTextLoading: {
    color: colors.textMuted
  },
  messageTextUser: {
    color: colors.text
  },
  messageTextSystem: {
    color: colors.textMuted
  },
  messageMeta: {
    color: colors.textSoft,
    fontSize: typography.caption
  },
  messageMetaLoading: {
    color: colors.textSoft
  },
  messageMetaError: {
    color: colors.danger
  },
  loadingDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  loadingDot: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.textSoft
  },
  retryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: borders.standard,
    borderColor: "rgba(197, 61, 61, 0.2)",
    backgroundColor: colors.surface
  },
  retryButtonText: {
    color: colors.danger,
    fontSize: typography.label,
    fontWeight: "700"
  },
  composer: {
    borderTopWidth: borders.standard,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: spacing.sm,
    gap: spacing.sm
  },
  capabilityNote: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20
  },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingBottom: spacing.xs
  },
  guestText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20
  },
  guestLink: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  guestLinkText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 48,
    borderRadius: radii.pill,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  iconButtonPrimary: {
    backgroundColor: colors.primary
  },
  iconButtonLoading: {
    borderWidth: borders.standard,
    borderColor: "rgba(0, 82, 204, 0.14)",
    backgroundColor: colors.primarySoft
  },
  iconButtonSecondary: {
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  iconButtonDisabled: {
    opacity: 0.45
  },
  iconButtonPressed: {
    opacity: 0.88
  }
});
