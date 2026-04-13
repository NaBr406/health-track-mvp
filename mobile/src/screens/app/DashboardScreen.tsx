import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton, Panel } from "../../components/clinical";
import { api } from "../../lib/api";
import { formatDateTime, formatWeekday, getShiftedDateString, getTodayString, parseLeadingNumber } from "../../lib/utils";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
import { borders, colors, layout, radii, shadows, spacing, typography } from "../../theme/tokens";
import type { AuthSession, DashboardMetric, DashboardSnapshot, HealthProfile } from "../../types";

type DashboardScreenProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  refreshToken: number;
  onOpenAdjustmentDetail: (snapshot: DashboardSnapshot) => void;
  onRequestSignIn: () => void;
};

type MetricCardMeta = {
  id: string;
  label: string;
  descriptor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  valueText: string;
  unitText?: string;
  statusText: string;
  helperText: string;
  progress?: number;
  bars?: Array<{
    label: string;
    ratio: number;
    value: number;
  }>;
};

const DEFAULT_CALORIE_TARGET = 1700;
const DEFAULT_EXERCISE_TARGET = 40;
const DEFAULT_GLUCOSE_TARGET = 7.2;
const FALLBACK_GLUCOSE_SERIES = [6.4, 7.2, 8.1, 6.9, 7.7, 6.6, 7.3];
const FALLBACK_BAR_RATIOS = [0.36, 0.58, 0.88, 0.47, 0.77, 0.41, 0.68];

export function DashboardScreen({
  session,
  healthProfile,
  refreshToken,
  onOpenAdjustmentDetail,
  onRequestSignIn
}: DashboardScreenProps) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { bottomInset, onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle } = useImmersiveTabBarScroll();

  useEffect(() => {
    void loadSnapshot(true);
  }, [refreshToken]);

  async function loadSnapshot(initial = false) {
    if (!initial) {
      setRefreshing(true);
    }

    try {
      setSnapshot(await api.getDashboardSnapshot(getTodayString()));
    } finally {
      setRefreshing(false);
    }
  }

  const adviceCard = useMemo(() => buildAdviceCard(snapshot), [snapshot]);
  const metricCards = useMemo(() => buildMetricCards(snapshot, healthProfile), [snapshot, healthProfile]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: layout.pageBottom + bottomInset }]}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSnapshot()} tintColor={colors.primary} />}
        scrollEventThrottle={scrollEventThrottle}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          disabled={!snapshot}
          onPress={() => snapshot && onOpenAdjustmentDetail(snapshot)}
          style={({ pressed }) => [styles.heroCard, pressed && snapshot ? styles.heroCardPressed : null]}
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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>今日概览</Text>
          <Text style={styles.sectionTitle}>关键指标</Text>
        </View>

        <View style={styles.metricGrid}>
          {metricCards.map((metric) =>
            metric.bars ? <TrendMetricCard key={metric.id} metric={metric} /> : <RingMetricCard key={metric.id} metric={metric} />
          )}
        </View>

        {!session ? (
          <Panel>
            <View style={styles.syncHeader}>
              <View style={styles.syncBadge}>
                <Ionicons color={colors.primary} name="cloud-offline-outline" size={16} />
                <Text style={styles.syncBadgeText}>本地离线模式</Text>
              </View>
              <Text style={styles.syncTitle}>当前可以继续浏览和记录</Text>
              <Text style={styles.syncDescription}>登录后可将资料、建议与对话同步到云端。</Text>
            </View>
            <OutlineButton label="登录同步" onPress={onRequestSignIn} variant="ghost" />
          </Panel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RingMetricCard({ metric }: { metric: MetricCardMeta }) {
  return (
    <View style={styles.metricCard}>
      <MetricCardHeader metric={metric} />
      <View style={styles.metricRow}>
        <MetricValueBlock metric={metric} />
        <CircularProgressRing progress={metric.progress ?? 0} />
      </View>
    </View>
  );
}

function TrendMetricCard({ metric }: { metric: MetricCardMeta }) {
  return (
    <View style={styles.metricCardWide}>
      <MetricCardHeader metric={metric} />
      <View style={styles.trendBody}>
        <MetricValueBlock metric={metric} />
        <MiniBarChart bars={metric.bars ?? []} />
      </View>
    </View>
  );
}

function MetricCardHeader({ metric }: { metric: MetricCardMeta }) {
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

function MetricValueBlock({ metric }: { metric: MetricCardMeta }) {
  return (
    <View style={styles.metricValueBlock}>
      <Text style={styles.metricValueText}>
        {metric.valueText}
        {metric.unitText ? <Text style={styles.metricUnitText}> {metric.unitText}</Text> : null}
      </Text>
      <Text style={styles.metricStatusText}>{metric.statusText}</Text>
      <Text style={styles.metricHelperText}>{metric.helperText}</Text>
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

function MiniBarChart({ bars }: { bars: Array<{ label: string; ratio: number; value: number }> }) {
  return (
    <View style={styles.barChart}>
      {bars.map((bar, index) => (
        <View key={`${bar.label}-${index}`} style={styles.barColumn}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  height: `${Math.max(bar.ratio * 100, 18)}%`,
                  opacity: 0.36 + index * 0.08
                }
              ]}
            />
          </View>
          <Text style={styles.barLabel}>{bar.label}</Text>
        </View>
      ))}
    </View>
  );
}

function buildAdviceCard(snapshot: DashboardSnapshot | null) {
  if (!snapshot) {
    return {
      title: "系统正在生成今日方案",
      summary: "同步最近的对话与监测摘要后，这里会显示压缩后的今日建议。",
      parameter: "等待同步",
      timestamp: "同步中"
    };
  }

  const parameterLabel = `${snapshot.adjustment.parameterLabel} ${snapshot.adjustment.parameterDelta}`;
  const normalizedLabel = snapshot.adjustment.parameterLabel.toUpperCase();
  let title = snapshot.adjustment.title;

  if (normalizedLabel.includes("CHO")) {
    title = `今日碳水建议 ${snapshot.adjustment.parameterDelta}`;
  } else if (normalizedLabel.includes("ACT")) {
    title = `今日活动时长建议 ${snapshot.adjustment.parameterDelta}`;
  } else if (normalizedLabel.includes("SLEEP")) {
    title = `今晚恢复窗口建议 ${snapshot.adjustment.parameterDelta}`;
  } else if (normalizedLabel.includes("GLU")) {
    title = `今日血糖控制建议 ${snapshot.adjustment.parameterDelta}`;
  }

  return {
    title,
    summary: snapshot.adjustment.summary,
    parameter: parameterLabel,
    timestamp: formatDateTime(snapshot.adjustment.generatedAt)
  };
}

function buildMetricCards(snapshot: DashboardSnapshot | null, healthProfile: HealthProfile | null): MetricCardMeta[] {
  const calorieTarget = resolveCalorieTarget(healthProfile);
  const calorieValue = getMetricNumber(snapshot, "calories");
  const exerciseValue = getMetricNumber(snapshot, "exercise");
  const glucoseValue = getMetricNumber(snapshot, "glucose");
  const glucoseBars = buildGlucoseBars(snapshot);

  return [
    {
      id: "calories",
      label: "热量",
      descriptor: "今日摄入",
      iconName: "flame-outline",
      valueText: formatMetricInteger(calorieValue),
      unitText: "kcal",
      statusText: calorieValue >= calorieTarget ? "接近目标区间" : `距离目标 ${Math.max(Math.round(calorieTarget - calorieValue), 0)} kcal`,
      helperText: `目标 ${Math.round(calorieTarget)} kcal`,
      progress: clamp(calorieValue / calorieTarget)
    },
    {
      id: "exercise",
      label: "运动时长",
      descriptor: "主动训练",
      iconName: "fitness-outline",
      valueText: formatMetricInteger(exerciseValue),
      unitText: "min",
      statusText: exerciseValue >= DEFAULT_EXERCISE_TARGET ? "已达到今日建议" : `还需 ${Math.max(Math.round(DEFAULT_EXERCISE_TARGET - exerciseValue), 0)} 分钟`,
      helperText: `目标 ${DEFAULT_EXERCISE_TARGET} 分钟`,
      progress: clamp(exerciseValue / DEFAULT_EXERCISE_TARGET)
    },
    {
      id: "glucose",
      label: "血糖趋势",
      descriptor: "近 7 日波动",
      iconName: "pulse-outline",
      valueText: glucoseValue > 0 ? glucoseValue.toFixed(1) : "--",
      unitText: "mmol/L",
      statusText: glucoseValue > 0 ? (glucoseValue <= DEFAULT_GLUCOSE_TARGET ? "维持在建议区间" : `略高于建议值 ${(glucoseValue - DEFAULT_GLUCOSE_TARGET).toFixed(1)}`) : "等待同步监测数据",
      helperText: `建议上限 ${DEFAULT_GLUCOSE_TARGET.toFixed(1)} mmol/L`,
      bars: glucoseBars
    }
  ];
}

function buildGlucoseBars(snapshot: DashboardSnapshot | null) {
  const history = snapshot?.history?.slice(-7) ?? [];
  const historyValues = history.map((item) => item.glucoseMmol);
  const values = hasVisualVariance(historyValues) ? historyValues : FALLBACK_GLUCOSE_SERIES;
  const focusDate = snapshot?.focusDate ?? getTodayString();
  const labels =
    history.length === 7
      ? history.map((item) => compactWeekday(item.date))
      : Array.from({ length: 7 }, (_, index) => compactWeekday(getShiftedDateString(focusDate, index - 6)));

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;

  return values.map((value, index) => ({
    label: labels[index] ?? "",
    value,
    ratio: range < 0.15 ? FALLBACK_BAR_RATIOS[index] : clamp(0.24 + ((value - minValue) / range) * 0.68, 0.24, 0.94)
  }));
}

function compactWeekday(date: string) {
  return formatWeekday(date).replace("星期", "").replace("周", "");
}

function hasVisualVariance(values: number[]) {
  if (values.length !== 7) {
    return false;
  }

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  return maxValue - minValue >= 0.15;
}

function resolveCalorieTarget(healthProfile: HealthProfile | null) {
  const value = parseLeadingNumber(healthProfile?.primaryTarget);
  return value && value >= 1200 && value <= 2600 ? value : DEFAULT_CALORIE_TARGET;
}

function findMetric(snapshot: DashboardSnapshot | null, id: string): DashboardMetric | undefined {
  return snapshot?.metrics.find((metric) => metric.id === id);
}

function getMetricNumber(snapshot: DashboardSnapshot | null, id: string) {
  return parseLeadingNumber(findMetric(snapshot, id)?.value) ?? 0;
}

function formatMetricInteger(value: number) {
  return value > 0 ? `${Math.round(value)}` : "--";
}

function clamp(value: number, min = 0, max = 1) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: layout.pageTop,
    paddingBottom: layout.pageBottom,
    gap: spacing.lg
  },
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
  },
  sectionHeader: {
    gap: spacing.xxs
  },
  sectionEyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.titleSmall,
    lineHeight: 30,
    fontWeight: "800"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricCard: {
    width: "48%",
    minWidth: 154,
    flexGrow: 1,
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  metricCardWide: {
    width: "100%",
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
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  trendBody: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md
  },
  metricValueBlock: {
    flex: 1,
    gap: spacing.xs
  },
  metricValueText: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  metricUnitText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
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
  barChart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: 108
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs
  },
  barTrack: {
    width: "100%",
    height: 86,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 82, 204, 0.08)",
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  barFill: {
    width: "100%",
    borderRadius: radii.pill,
    minHeight: 12,
    backgroundColor: colors.primary
  },
  barLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  syncHeader: {
    gap: spacing.sm
  },
  syncBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  syncBadgeText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  syncTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  syncDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  }
});
