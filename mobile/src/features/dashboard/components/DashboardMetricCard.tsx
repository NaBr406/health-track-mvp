import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { borders, colors, radii, shadows, spacing, typography } from "../../../theme/tokens";
import type { MetricCardMeta } from "../model/dashboardScreenModel";
import { GlucoseLineChart } from "./GlucoseLineChart";

type DashboardMetricCardProps = {
  metric: MetricCardMeta;
};

export function DashboardMetricCard({ metric }: DashboardMetricCardProps) {
  return metric.chart ? <GlucoseMetricCard metric={metric} /> : <RingMetricCard metric={metric} />;
}

function RingMetricCard({ metric }: DashboardMetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <MetricCardHeader metric={metric} />
      <View style={styles.metricBody}>
        <MetricValueBlock metric={metric} />
        <View style={styles.metricRingRow}>
          <CircularProgressRing progress={metric.progress ?? 0} />
        </View>
      </View>
    </View>
  );
}

function GlucoseMetricCard({ metric }: DashboardMetricCardProps) {
  if (!metric.chart) {
    return null;
  }

  return (
    <View style={styles.glucoseTrendCard}>
      <View style={styles.glucoseTrendHeader}>
        <View style={styles.glucoseTrendTitleBlock}>
          <Text style={styles.glucoseTrendTitle}>{metric.label}</Text>
          <Text style={styles.glucoseTrendSubtitle}>{metric.descriptor}</Text>
        </View>
        <View style={styles.glucoseTrendValueBlock}>
          <View style={styles.glucoseTrendValueLine}>
            <Text style={styles.glucoseTrendValueText}>{metric.valueText}</Text>
            {metric.unitText ? <Text style={styles.glucoseTrendValueUnit}>{metric.unitText}</Text> : null}
          </View>
          {(metric.statusText || metric.helperText) ? (
            <View style={styles.glucoseTrendMetaBlock}>
              {metric.statusText ? <Text style={styles.glucoseTrendStatusText}>{metric.statusText}</Text> : null}
              {metric.helperText ? <Text style={styles.glucoseTrendHelperText}>{metric.helperText}</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
      <GlucoseLineChart chart={metric.chart} />
      <Text style={styles.glucoseTrendFooter}>{metric.chart.footerText}</Text>
    </View>
  );
}

function MetricCardHeader({ metric }: DashboardMetricCardProps) {
  return (
    <View style={styles.metricHeader}>
      <View style={styles.metricIconWrap}>
        <Ionicons color={colors.primary} name={metric.iconName} size={17} />
      </View>
      <View style={styles.metricHeaderCopy}>
        <Text style={styles.metricLabel}>{metric.label}</Text>
        <Text style={styles.metricDescriptor}>{metric.descriptor}</Text>
      </View>
    </View>
  );
}

function MetricValueBlock({ metric }: DashboardMetricCardProps) {
  return (
    <View style={styles.metricValueBlock}>
      <View style={styles.metricValueLine}>
        <Text style={styles.metricValueText}>{metric.valueText}</Text>
        {metric.unitText ? <Text style={styles.metricUnitText}>{metric.unitText}</Text> : null}
      </View>
      <View style={styles.metricMetaBlock}>
        {metric.statusText ? <Text style={styles.metricStatusText}>{metric.statusText}</Text> : null}
        {metric.helperText ? <Text style={styles.metricHelperText}>{metric.helperText}</Text> : null}
      </View>
    </View>
  );
}

function CircularProgressRing({ progress }: { progress: number }) {
  const size = 64;
  const stroke = 5;
  const clamped = clamp(progress);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.ringWrap}>
      <Svg height={size} width={size}>
        <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke="rgba(0, 82, 204, 0.10)" strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          originX={size / 2}
          originY={size / 2}
          r={radius}
          rotation={-90}
          stroke={colors.primary}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPercentText}>{Math.round(clamped * 100)}%</Text>
      </View>
    </View>
  );
}

function clamp(value: number, min = 0, max = 1) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  metricCard: {
    flexBasis: "48%",
    minWidth: 154,
    minHeight: 188,
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  metricHeaderCopy: {
    flex: 1,
    gap: 2
  },
  metricLabel: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  metricDescriptor: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 18
  },
  metricBody: {
    flex: 1,
    justifyContent: "space-between",
    gap: spacing.md
  },
  metricRingRow: {
    alignItems: "flex-end"
  },
  metricValueBlock: {
    gap: spacing.sm
  },
  metricValueLine: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "nowrap",
    gap: spacing.xs
  },
  metricMetaBlock: {
    minHeight: 40,
    gap: 2
  },
  metricValueText: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -0.5,
    includeFontPadding: false
  },
  metricUnitText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 16,
    fontWeight: "600",
    paddingBottom: 6,
    includeFontPadding: false
  },
  metricStatusText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
    fontWeight: "600"
  },
  metricHelperText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 18
  },
  ringWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center"
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center"
  },
  ringPercentText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "800"
  },
  glucoseTrendCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: borders.standard,
    borderColor: "#D9E6E7",
    backgroundColor: "#F4FAFA",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  glucoseTrendHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  glucoseTrendTitleBlock: {
    flex: 1,
    gap: spacing.xxs
  },
  glucoseTrendTitle: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900"
  },
  glucoseTrendSubtitle: {
    color: colors.textMuted,
    fontSize: 17,
    fontWeight: "600"
  },
  glucoseTrendValueBlock: {
    maxWidth: "52%",
    alignItems: "flex-end",
    gap: spacing.xxs
  },
  glucoseTrendValueLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs
  },
  glucoseTrendValueText: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -0.6,
    includeFontPadding: false
  },
  glucoseTrendValueUnit: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 16,
    fontWeight: "700",
    paddingBottom: 5,
    includeFontPadding: false
  },
  glucoseTrendMetaBlock: {
    alignItems: "flex-end",
    gap: 2
  },
  glucoseTrendStatusText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "right"
  },
  glucoseTrendHelperText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: "right"
  },
  glucoseTrendFooter: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600"
  }
});
