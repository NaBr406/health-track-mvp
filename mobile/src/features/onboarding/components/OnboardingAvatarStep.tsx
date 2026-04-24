import type { TextInputProps } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { InputField, OutlineButton } from "../../../components/clinical";
import { ProfileAvatar } from "../../../components/ProfileAvatar";
import { avatarPresets } from "../../../lib/avatarPresets";
import { colors, spacing, typography } from "../../../theme/tokens";
import type { WizardForm } from "../model/onboardingWizardModel";

type OnboardingAvatarStepProps = {
  form: WizardForm;
  pickingAvatar: boolean;
  onFieldFocus?: TextInputProps["onFocus"];
  onPickCustomAvatar: () => void;
  onResetAvatar: () => void;
  onSelectPreset: (presetId: string) => void;
  onNicknameChange: (value: string) => void;
};

export function OnboardingAvatarStep({
  form,
  pickingAvatar,
  onFieldFocus,
  onPickCustomAvatar,
  onResetAvatar,
  onSelectPreset,
  onNicknameChange
}: OnboardingAvatarStepProps) {
  return (
    <View style={styles.formBlock}>
      <View style={styles.avatarPreviewCard}>
        <ProfileAvatar avatarUri={form.avatarUri} nickname={form.nickname} presetId={form.avatarPresetId} size={86} />
        <View style={styles.avatarPreviewCopy}>
          <Text style={styles.avatarPreviewTitle}>{form.nickname.trim() || "你的头像预览"}</Text>
          <Text style={styles.avatarPreviewDescription}>设置一个容易识别的头像和昵称，后续记录会更自然。</Text>
        </View>
      </View>

      <View style={styles.avatarActionRow}>
        <OutlineButton label={pickingAvatar ? "读取中..." : "从相册选择"} onPress={onPickCustomAvatar} variant="primary" disabled={pickingAvatar} />
        {form.avatarUri ? <OutlineButton label="恢复预设头像" onPress={onResetAvatar} variant="secondary" /> : null}
      </View>

      <View style={styles.avatarGrid}>
        {avatarPresets.map((preset) => {
          const selected = !form.avatarUri && form.avatarPresetId === preset.id;

          return (
            <Pressable
              accessibilityRole="button"
              key={preset.id}
              onPress={() => onSelectPreset(preset.id)}
              style={({ pressed }) => [styles.avatarOption, selected ? styles.avatarOptionSelected : null, pressed ? styles.avatarOptionPressed : null]}
            >
              <ProfileAvatar nickname={form.nickname} presetId={preset.id} size={56} />
              <View style={styles.avatarOptionLabelRow}>
                <Text style={[styles.avatarOptionLabel, selected ? styles.avatarOptionLabelSelected : null]}>{preset.label}</Text>
                {selected ? <Ionicons color={colors.primary} name="checkmark-circle" size={14} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <InputField label="昵称" onFocus={onFieldFocus} placeholder="例如：林岚" value={form.nickname} onChangeText={onNicknameChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  formBlock: {
    gap: spacing.md
  },
  avatarPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    padding: spacing.md
  },
  avatarPreviewCopy: {
    flex: 1,
    gap: spacing.xs
  },
  avatarPreviewTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  avatarPreviewDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  avatarActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  avatarOption: {
    width: "31%",
    minWidth: 92,
    borderRadius: 18,
    backgroundColor: "#F9FAFC",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: spacing.sm
  },
  avatarOptionSelected: {
    backgroundColor: colors.primarySoft
  },
  avatarOptionPressed: {
    opacity: 0.88
  },
  avatarOptionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  avatarOptionLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  avatarOptionLabelSelected: {
    color: colors.primary
  }
});
