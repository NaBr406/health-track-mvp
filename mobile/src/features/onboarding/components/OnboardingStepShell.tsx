import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, shadows, spacing, typography } from "../../../theme/tokens";
import { onboardingStepMeta } from "../model/onboardingWizardModel";

type OnboardingStepShellProps = {
  step: number;
  children: ReactNode;
};

export function OnboardingStepShell({ step, children }: OnboardingStepShellProps) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepTopRow}>
        <View>
          <Text style={styles.stepLabel}>步骤 {step + 1}</Text>
          <Text style={styles.stepTitle}>{onboardingStepMeta[step].title}</Text>
          <Text style={styles.stepDescription}>{onboardingStepMeta[step].description}</Text>
        </View>
        <Text style={styles.stepFraction}>0{step + 1}/0{onboardingStepMeta.length}</Text>
      </View>

      <View style={styles.stepRail}>
        {onboardingStepMeta.map((item, index) => {
          const active = index <= step;

          return (
            <View key={item.title} style={styles.stepRailItem}>
              <View style={[styles.stepRailDot, active ? styles.stepRailDotActive : null]}>
                <Text style={[styles.stepRailDotText, active ? styles.stepRailDotTextActive : null]}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepRailText, index === step ? styles.stepRailTextActive : null]}>{item.title}</Text>
            </View>
          );
        })}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stepCard: {
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card
  },
  stepTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  stepLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "800"
  },
  stepTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.bodyLarge,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  stepDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    marginTop: spacing.xs
  },
  stepFraction: {
    color: colors.textSoft,
    fontSize: typography.label,
    fontWeight: "700"
  },
  stepRail: {
    flexDirection: "row",
    gap: spacing.sm
  },
  stepRailItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs
  },
  stepRailDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center"
  },
  stepRailDotActive: {
    backgroundColor: colors.primary
  },
  stepRailDotText: {
    color: colors.textSoft,
    fontSize: typography.label,
    fontWeight: "700"
  },
  stepRailDotTextActive: {
    color: colors.inverseText
  },
  stepRailText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    textAlign: "center"
  },
  stepRailTextActive: {
    color: colors.text,
    fontWeight: "700"
  }
});
