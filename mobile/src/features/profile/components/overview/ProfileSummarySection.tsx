import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, shadows, spacing, typography } from "../../../../theme/tokens";
import { SectionHead, summaryHelperToneStyles } from "./ProfileOverviewPrimitives";
import type { ProfileOverviewSummaryCard } from "../../model/profileOverview";

type ProfileSummarySectionProps = {
  canEditProfile: boolean;
  onOpenHealthProfile: () => void;
  onRequestSignIn: () => void;
  summaryCards: ProfileOverviewSummaryCard[];
};

export function ProfileSummarySection({
  canEditProfile,
  onOpenHealthProfile,
  onRequestSignIn,
  summaryCards
}: ProfileSummarySectionProps) {
  const openDetail = canEditProfile ? onOpenHealthProfile : onRequestSignIn;

  return (
    <View style={styles.sectionCard}>
      <SectionHead description="关键信息一目了然" title="健康档案摘要" />

      <View style={styles.summaryGrid}>
        {summaryCards.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.key}
            onPress={openDetail}
            style={({ pressed }) => [styles.summaryCard, pressed ? styles.pressed : null]}
          >
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text numberOfLines={3} style={[styles.summaryValue, item.value === "暂未填写" ? styles.summaryValueEmpty : null]}>
              {item.value}
            </Text>
            <Text style={[styles.summaryHelper, summaryHelperToneStyles[item.tone]]}>{item.helper}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={openDetail} style={({ pressed }) => [styles.inlineActionRow, pressed ? styles.pressed : null]}>
        <Text style={styles.inlineActionLabel}>查看完整健康档案</Text>
        <Ionicons color={colors.primary} name="chevron-forward" size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 26,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md
  },
  summaryCard: {
    width: "48.5%",
    height: 136,
    borderRadius: 20,
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    gap: spacing.xs
  },
  pressed: {
    opacity: 0.86
  },
  summaryLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  summaryValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22,
    fontWeight: "700"
  },
  summaryValueEmpty: {
    color: colors.textMuted,
    fontWeight: "600"
  },
  summaryHelper: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  inlineActionRow: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md
  },
  inlineActionLabel: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: "800"
  }
});
