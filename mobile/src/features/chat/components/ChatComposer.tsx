import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { borders, colors, radii, spacing, typography } from "../../../theme/tokens";

type ChatComposerProps = {
  draft: string;
  note: string;
  sendButtonDisabled: boolean;
  sending: boolean;
  showGuestPrompt: boolean;
  voiceButtonDisabled: boolean;
  onChangeDraft: (value: string) => void;
  onFocus: () => void;
  onRequestSignIn: () => void;
  onSendText: () => void;
  onSendVoice: () => void;
};

export function ChatComposer({
  draft,
  note,
  sendButtonDisabled,
  sending,
  showGuestPrompt,
  voiceButtonDisabled,
  onChangeDraft,
  onFocus,
  onRequestSignIn,
  onSendText,
  onSendVoice
}: ChatComposerProps) {
  return (
    <>
      {note ? <Text style={styles.capabilityNote}>{note}</Text> : null}

      {showGuestPrompt ? (
        <View style={styles.guestRow}>
          <Text style={styles.guestText}>游客模式也能继续记录；登录后会自动切换到该账号自己的数据空间。</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRequestSignIn}
            style={({ pressed }) => [styles.guestLink, pressed ? styles.pressedState : null]}
          >
            <Text style={styles.guestLinkText}>登录账号</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.composerRow}>
        <TextInput
          blurOnSubmit={false}
          onChangeText={onChangeDraft}
          onFocus={onFocus}
          onSubmitEditing={() => onSendText()}
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
          onPress={onSendVoice}
          style={({ pressed }) => [
            styles.iconButton,
            styles.iconButtonSecondary,
            voiceButtonDisabled ? styles.iconButtonDisabled : null,
            pressed && !voiceButtonDisabled ? styles.pressedState : null
          ]}
        >
          <Ionicons color={voiceButtonDisabled ? colors.textSoft : colors.primary} name="mic-outline" size={20} />
        </Pressable>

        <Pressable
          accessibilityLabel={sending ? "正在发送" : "发送消息"}
          accessibilityRole="button"
          disabled={sendButtonDisabled}
          onPress={onSendText}
          style={({ pressed }) => [
            styles.iconButton,
            sending ? styles.iconButtonLoading : styles.iconButtonPrimary,
            sendButtonDisabled ? styles.iconButtonDisabled : null,
            pressed && !sendButtonDisabled ? styles.pressedState : null
          ]}
        >
          <Ionicons
            color={sending ? colors.primary : colors.inverseText}
            name={sending ? "time-outline" : "arrow-up"}
            size={20}
          />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
  pressedState: {
    opacity: 0.88
  }
});
