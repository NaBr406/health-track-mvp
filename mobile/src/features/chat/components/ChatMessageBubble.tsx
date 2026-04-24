import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { borders, colors, radii, spacing, typography } from "../../../theme/tokens";
import { buildMessageMeta, type UIChatMessage } from "../model/chatMessageUi";
import { LoadingDots } from "./LoadingDots";

type ChatMessageBubbleProps = {
  message: UIChatMessage;
  onRetry: (messageId: string) => void;
};

export function ChatMessageBubble({ message, onRetry }: ChatMessageBubbleProps) {
  const isLoading = message.uiState === "loading";
  const isError = message.uiState === "error";

  return (
    <View
      style={[
        styles.messageRow,
        message.role === "user" ? styles.messageRowUser : message.role === "system" ? styles.messageRowSystem : null
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          message.role === "user"
            ? styles.messageBubbleUser
            : message.role === "system"
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
            message.role === "user" ? styles.messageTextUser : message.role === "system" ? styles.messageTextSystem : null,
            isLoading ? styles.messageTextLoading : null
          ]}
        >
          {message.content}
        </Text>

        {isLoading ? <LoadingDots /> : null}

        {isError && message.retryPayload ? (
          <Pressable
            accessibilityLabel="重试发送"
            accessibilityRole="button"
            onPress={() => onRetry(message.id)}
            style={({ pressed }) => [styles.retryButton, pressed ? styles.pressedState : null]}
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
          {buildMessageMeta(message)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  pressedState: {
    opacity: 0.88
  }
});
