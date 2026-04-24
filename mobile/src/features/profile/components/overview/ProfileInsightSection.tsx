import { StyleSheet, Text, View } from "react-native";
import { OutlineButton } from "../../../../components/clinical";
import { colors, fonts, shadows, spacing, typography } from "../../../../theme/tokens";
import { MetricTile, SectionHead, StatusBadge } from "./ProfileOverviewPrimitives";
import type { ProfileWeeklyInsight } from "../../model/profileOverview";

type ProfileInsightSectionProps = {
  loading: boolean;
  onGoToAIChat: () => void;
  weeklyInsight: ProfileWeeklyInsight;
};

export function ProfileInsightSection({ loading, onGoToAIChat, weeklyInsight }: ProfileInsightSectionProps) {
  return (
    <View style={styles.sectionCard}>
      <SectionHead description={loading ? "正在更新最近一周记录" : "重点指标优先展示"} title="近 7 天健康趋势" />

      <View style={styles.highlightMetricCard}>
        <View style={styles.highlightTopRow}>
          <View>
            <Text style={styles.metricLabel}>7 日平均血糖</Text>
            {weeklyInsight.averageGlucose !== null ? (
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>{weeklyInsight.averageGlucose.toFixed(1)}</Text>
                <Text style={styles.metricUnit}>mmol/L</Text>
              </View>
            ) : (
              <Text style={styles.metricPlaceholder}>暂无血糖数据</Text>
            )}
          </View>
          <StatusBadge label={weeklyInsight.statusLabel} tone={weeklyInsight.statusTone} />
        </View>

        <Text style={styles.highlightHint}>最近 7 天共记录 {weeklyInsight.recordDays} 天</Text>

        {!weeklyInsight.hasData ? (
          <View style={styles.metricActionRow}>
            <OutlineButton label="去记录" onPress={onGoToAIChat} variant="primary" />
          </View>
        ) : null}
      </View>

      <View style={styles.metricsGrid}>
        <MetricTile label="7 日记录天数" value={`${weeklyInsight.recordDays}`} unit="天" />
        <MetricTile
          label="7 日平均运动"
          value={weeklyInsight.averageExercise !== null ? `${Math.round(weeklyInsight.averageExercise)}` : "暂无记录"}
          unit={weeklyInsight.averageExercise !== null ? "min" : undefined}
        />
        <MetricTile
          label="7 日平均热量"
          value={weeklyInsight.averageCalories !== null ? `${Math.round(weeklyInsight.averageCalories)}` : "暂无记录"}
          unit={weeklyInsight.averageCalories !== null ? "kcal" : undefined}
        />
        <MetricTile label="最近一次记录" value={weeklyInsight.lastRecordLabel} />
      </View>
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
  highlightMetricCard: {
    borderRadius: 24,
    backgroundColor: "#F5F9FF",
    padding: spacing.xl,
    gap: spacing.sm
  },
  highlightTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  metricLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    fontWeight: "800"
  },
  metricUnit: {
    color: colors.textSoft,
    fontSize: typography.label,
    fontWeight: "700",
    paddingBottom: 4
  },
  metricPlaceholder: {
    color: colors.textMuted,
    fontSize: typography.bodyLarge,
    lineHeight: 28,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  highlightHint: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  metricActionRow: {
    paddingTop: spacing.xs
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md
  }
});
