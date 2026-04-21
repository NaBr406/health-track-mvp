import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { formatTime, getTodayString } from "../../lib/utils";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
import { borders, colors, layout, radii, spacing, typography } from "../../theme/tokens";
import type { AuthSession, ChatMessage, HealthProfile } from "../../types";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dataSource, setDataSource] = useState<"server" | "mock">("mock");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [capabilityNote, setCapabilityNote] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const insets = useSafeAreaInsets();
  const { bottomInset, hidden, onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle } = useImmersiveTabBarScroll();
  const composerMarginAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void loadThread();
  }, [healthProfile?.updatedAt, session?.userId]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  async function loadThread() {
    const thread = await api.getChatThread(getTodayString());
    setMessages(thread.messages);
    setDataSource(thread.dataSource);
  }

  async function handleSend(inputMode: "text" | "voice" = "text") {
    const content = draft.trim();

    if (!content) {
      if (inputMode === "voice") {
        setCapabilityNote("语音入口已预留，接入录音与转写后会直接发送到今天的对话中。");
      }

      return;
    }

    setSending(true);
    setCapabilityNote(inputMode === "voice" ? "当前会沿用文本提交通道，后续可替换为真实录音与转写上传。" : "");

    try {
      const result = await api.sendChatMessage({
        focusDate: getTodayString(),
        inputMode,
        message: content
      });

      setMessages(result.messages);
      setDataSource(result.dataSource);
      setDraft("");
      onConversationCommitted();
    } catch {
      Alert.alert("发送失败", "这条记录还没有写入云端，所以不会出现在其他设备上。请检查网络后重试。");
    } finally {
      setSending(false);
    }
  }

  const threadHint = dataSource === "server" ? "当前展示的是账号专属对话数据" : "当前展示的是本地身份空间中的对话记录";
  const voiceButtonDisabled = sending;
  const sendButtonDisabled = sending || !draft.trim();
  const composerPaddingBottom = Platform.OS === "ios" ? Math.max(insets.bottom, spacing.xs) : spacing.xs;
  const hiddenComposerFloor = Math.max(insets.bottom, spacing.sm);
  const visibleComposerMarginBottom = bottomInset > 0 ? bottomInset - composerPaddingBottom : hiddenComposerFloor;

  useEffect(() => {
    Animated.spring(composerMarginAnimation, {
      damping: 22,
      mass: 0.9,
      stiffness: 240,
      toValue: hidden ? hiddenComposerFloor : visibleComposerMarginBottom,
      useNativeDriver: false
    }).start();
  }, [composerMarginAnimation, hidden, hiddenComposerFloor, visibleComposerMarginBottom]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        style={styles.flex}
      >
        <View style={styles.flex}>
          <FlatList
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={<Text style={styles.threadHint}>{threadHint}</Text>}
            onScroll={onScroll}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            ref={listRef}
            renderItem={({ item }) => (
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
                        : styles.messageBubbleAssistant
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      item.role === "user" ? styles.messageTextUser : item.role === "system" ? styles.messageTextSystem : null
                    ]}
                  >
                    {item.content}
                  </Text>
                  <Text style={styles.messageMeta}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            )}
            scrollEventThrottle={scrollEventThrottle}
            showsVerticalScrollIndicator={false}
          />

          <Animated.View
            style={[
              styles.composer,
              {
                marginBottom: composerMarginAnimation,
                paddingBottom: composerPaddingBottom
              }
            ]}
          >
            {capabilityNote ? <Text style={styles.capabilityNote}>{capabilityNote}</Text> : null}

            {!session ? (
              <View style={styles.guestRow}>
                <Text style={styles.guestText}>游客模式也能继续记录；登录后会直接切换到该账号自己的数据空间。</Text>
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
                <Ionicons color={colors.primary} name="mic-outline" size={20} />
              </Pressable>

              <Pressable
                accessibilityLabel="发送消息"
                accessibilityRole="button"
                disabled={sendButtonDisabled}
                onPress={() => void handleSend("text")}
                style={({ pressed }) => [
                  styles.iconButton,
                  styles.iconButtonPrimary,
                  sendButtonDisabled ? styles.iconButtonDisabled : null,
                  pressed && !sendButtonDisabled ? styles.iconButtonPressed : null
                ]}
              >
                <Ionicons color={colors.inverseText} name="arrow-up" size={20} />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
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
  messageBubbleUser: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(0, 82, 204, 0.14)"
  },
  messageBubbleSystem: {
    backgroundColor: colors.surface
  },
  messageText: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    lineHeight: 26
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
