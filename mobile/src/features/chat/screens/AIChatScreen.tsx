import { useCallback, useRef } from "react";
import { Animated, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatComposer } from "../components/ChatComposer";
import { ChatMessageBubble } from "../components/ChatMessageBubble";
import { useChatComposerLift } from "../hooks/useChatComposerLift";
import { useChatThreadState } from "../hooks/useChatThreadState";
import type { UIChatMessage } from "../model/chatMessageUi";
import { useImmersiveTabBarScroll } from "../../../navigation/ImmersiveTabBarContext";
import { borders, colors, layout, spacing, typography } from "../../../theme/tokens";
import type { AuthSession, HealthProfile } from "../../../types";

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
  const listRef = useRef<FlatList<UIChatMessage>>(null);
  const insets = useSafeAreaInsets();
  const { bottomInset, hidden, onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle } = useImmersiveTabBarScroll();
  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);
  const {
    composerNote,
    draft,
    handleRetry,
    handleSend,
    messages,
    sendButtonDisabled,
    sending,
    setDraft,
    threadHint,
    voiceButtonDisabled
  } = useChatThreadState({
    healthProfileUpdatedAt: healthProfile?.updatedAt,
    onConversationCommitted,
    scrollToBottom,
    sessionUserId: session?.userId
  });
  const { composerLiftAnimation, composerMarginBottom, composerPaddingBottom, handleComposerFocus, handleLayout } = useChatComposerLift({
    bottomInset,
    hidden,
    insetsBottom: insets.bottom,
    scrollToBottom
  });

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
