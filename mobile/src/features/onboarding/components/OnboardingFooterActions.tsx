import { StyleSheet, Text, View } from "react-native";
import { OutlineButton } from "../../../components/clinical";
import { spacing, typography, colors } from "../../../theme/tokens";

type OnboardingFooterActionsProps = {
  mode: "initial" | "edit";
  step: number;
  totalSteps: number;
  canProceed: boolean;
  saving: boolean;
  onDismiss: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

export function OnboardingFooterActions({
  mode,
  step,
  totalSteps,
  canProceed,
  saving,
  onDismiss,
  onPrevious,
  onNext,
  onSubmit
}: OnboardingFooterActionsProps) {
  return (
    <>
      <View style={styles.footerHintCard}>
        <Text style={styles.footerHintText}>日常记录可通过 AI 对话快速完成，资料页只保留少量核心信息维护。</Text>
      </View>

      <View style={styles.footerActions}>
        {step === 0 ? (
          <OutlineButton fullWidth label={mode === "initial" ? "稍后完善" : "关闭"} onPress={onDismiss} variant="secondary" />
        ) : (
          <OutlineButton fullWidth label="上一步" onPress={onPrevious} variant="secondary" />
        )}

        {step < totalSteps - 1 ? (
          <OutlineButton fullWidth disabled={!canProceed} label="下一步" onPress={onNext} variant="primary" />
        ) : (
          <OutlineButton
            fullWidth
            disabled={!canProceed || saving}
            label={saving ? "保存中..." : mode === "initial" ? "完成建档" : "保存资料"}
            onPress={onSubmit}
            variant="primary"
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  footerHintCard: {
    borderRadius: 18,
    backgroundColor: "#F9FAFC",
    padding: spacing.md
  },
  footerHintText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  footerActions: {
    flexDirection: "row",
    gap: spacing.md
  }
});
