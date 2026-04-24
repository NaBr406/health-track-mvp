import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { borders, colors, radii, shadows, spacing, typography } from "../../../theme/tokens";
import type { AdviceCardMeta } from "../model/dashboardScreenModel";

type DashboardAdviceCardProps = {
  adviceCard: AdviceCardMeta;
  disabled: boolean;
  onPress: () => void;
};

export function DashboardAdviceCard({ adviceCard, disabled, onPress }: DashboardAdviceCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.heroCard, pressed && !disabled ? styles.heroCardPressed : null]}
    >
      <View style={styles.heroHeader}>
        <View style={styles.heroBadge}>
          <Ionicons color={colors.primary} name="sparkles-outline" size={14} />
          <Text style={styles.heroBadgeText}>今日 AI 建议</Text>
        </View>
        <Text style={styles.heroTimestamp}>{adviceCard.timestamp}</Text>
      </View>

      <Text style={styles.heroTitle}>{adviceCard.title}</Text>
      <Text numberOfLines={2} style={styles.heroSummary}>
        {adviceCard.summary}
      </Text>

      <View style={styles.heroFooter}>
        <View style={styles.parameterPill}>
          <Ionicons color={colors.primary} name="options-outline" size={14} />
          <Text style={styles.parameterPillText}>{adviceCard.parameter}</Text>
        </View>
        <View style={styles.detailLink}>
          <Text style={styles.detailLinkText}>查看完整方案</Text>
          <Ionicons color={colors.primary} name="chevron-forward" size={16} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  heroCardPressed: {
    opacity: 0.94
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  heroBadgeText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  heroTimestamp: {
    color: colors.textSoft,
    fontSize: typography.caption
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800"
  },
  heroSummary: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  parameterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  parameterPillText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: "700"
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs
  },
  detailLinkText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: "700"
  }
});
