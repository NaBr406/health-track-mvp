import { StyleSheet, Text, View } from "react-native";
import { OutlineButton } from "../../../components/clinical";
import { colors, fonts, shadows, spacing, typography } from "../../../theme/tokens";

type OnboardingHeroCardProps = {
  mode: "initial" | "edit";
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  onDismiss: () => void;
};

export function OnboardingHeroCard({ mode, step, totalSteps, title, description, onDismiss }: OnboardingHeroCardProps) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>{mode === "initial" ? "健康档案" : "资料编辑"}</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroDescription}>{description}</Text>
        </View>

        <OutlineButton compact label={mode === "initial" ? "稍后完善" : "关闭"} onPress={onDismiss} variant="ghost" />
      </View>

      <View style={styles.progressSummaryRow}>
        <View style={styles.progressChip}>
          <Text style={styles.progressChipLabel}>当前进度</Text>
          <Text style={styles.progressChipValue}>
            {step + 1}/{totalSteps}
          </Text>
        </View>
        <View style={styles.progressChip}>
          <Text style={styles.progressChipLabel}>完成后效果</Text>
          <Text style={styles.progressChipValue}>档案更完整</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#F5F9FF",
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.lift
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  heroEyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "800"
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleSmall,
    lineHeight: 32,
    fontWeight: "800"
  },
  heroDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  progressSummaryRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  progressChip: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  progressChipLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  progressChipValue: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  }
});
