import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton, Panel } from "../../components/clinical";
import { api } from "../../lib/api";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
import { formatDateTime, formatWeekday, getShiftedDateString, getTodayString, parseLeadingNumber } from "../../lib/utils";
import { borders, colors, layout, radii, shadows, spacing, typography } from "../../theme/tokens";
import type { AuthSession, DashboardMetric, DashboardSnapshot, HealthProfile } from "../../types";

type DashboardScreenProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  refreshToken: number;
  onOpenAdjustmentDetail: (snapshot: DashboardSnapshot) => void;
  onRequestSignIn: () => void;
};

type AdviceTone = {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  panelBackground: string;
  cardBackground: string;
  chipBackground: string;
  chipTextColor: string;
  statusLabel: string;
};

type MetricCardMeta = {
  id: string;
  label: string;
  descriptor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  softBackground: string;
  valueText: string;
  unitText?: string;
  statusText: string;
  targetText: string;
  progress?: number;
  values?: number[];
};

type TrendBarDatum = {
  date: string;
  progress: number;
};

type WeeklyBars = {
  calorieValues: TrendBarDatum[];
  exerciseValues: TrendBarDatum[];
};

const DEFAULT_CALORIE_TARGET = 1700;
const DEFAULT_EXERCISE_TARGET = 40;
const DEFAULT_STEP_TARGET = 8000;
const DEFAULT_SLEEP_TARGET = 7.5;
const DEFAULT_GLUCOSE_TARGET = 7.2;

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

  const adviceTone = useMemo(() => resolveAdviceTone(snapshot), [snapshot]);
  const adviceSummary = useMemo(() => buildCompactAdvice(snapshot), [snapshot]);
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
          style={({ pressed }) => [
            styles.heroPanel,
            { backgroundColor: adviceTone.panelBackground },
            pressed && snapshot ? styles.heroPanelPressed : null
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroLabelRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: adviceTone.iconBackground }]}>
                <Ionicons color={adviceTone.iconColor} name={adviceTone.iconName} size={18} />
              </View>
              <Text style={styles.heroEyebrow}>今日 AI 建议</Text>
            </View>
            <StatusChip tone={adviceTone} />
          </View>

          <Text style={styles.heroTitle}>{adviceSummary.lead}</Text>
          <Text numberOfLines={2} style={styles.heroReason}>
            {adviceSummary.reason}
          </Text>

          <View style={styles.heroFooter}>
            <View style={styles.parameterChip}>
              <Ionicons color={adviceTone.iconColor} name="options-outline" size={14} />
              <Text style={styles.parameterChipText}>
                {snapshot ? `${snapshot.adjustment.parameterLabel} ${snapshot.adjustment.parameterDelta}` : "等待同步"}
              </Text>
            </View>
            <View style={styles.heroLinkRow}>
              <Text style={styles.heroLinkText}>查看详情</Text>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
            </View>
          </View>
        </Pressable>

        <View style={styles.metricsSection}>
          <View style={styles.metricsHeaderRow}>
            <View style={[styles.metricIconWrap, styles.metricsHeaderIcon]}>
              <Ionicons color={colors.primary} name="pulse-outline" size={18} />
            </View>
            <View style={styles.metricsHeaderCopy}>
              <Text style={styles.metricsHeaderEyebrow}>今日监测</Text>
              <Text style={styles.metricsHeaderTitle}>3 个核心指标</Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            {metricCards.map((metric) => (metric.values ? <TrendMetricCard key={metric.id} metric={metric} /> : <RingMetricCard key={metric.id} metric={metric} />))}
          </View>
        </View>

        {!session ? (
          <Panel>
            <DashboardSectionHeader
              description="建档、建议查看和健康记录都可继续使用，需要跨设备同步时再登录即可。"
              eyebrow="访客模式"
              iconBackground={colors.primarySoft}
              iconColor={colors.primary}
              iconName="cloud-offline-outline"
              title="当前以本地演示模式运行"
            />
            <OutlineButton label="登录同步" onPress={onRequestSignIn} variant="ghost" />
          </Panel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardSectionHeader({
  eyebrow,
  title,
  description,
  iconName,
  iconColor,
  iconBackground,
  trailing
}: {
  eyebrow: string;
  title: string;
  description?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderMain}>
        <View style={[styles.sectionIconWrap, { backgroundColor: iconBackground }]}>
          <Ionicons color={iconColor} name={iconName} size={18} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
          {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
        </View>
      </View>
      {trailing ? <View style={styles.sectionTrailing}>{trailing}</View> : null}
    </View>
  );
}

function StatusChip({ tone }: { tone: AdviceTone }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: tone.chipBackground }]}>
      <Text style={[styles.statusChipText, { color: tone.chipTextColor }]}>{tone.statusLabel}</Text>
    </View>
  );
}

function SummaryMetaChip({
  iconName,
  label,
  value
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaChip}>
      <View style={styles.metaChipLabelRow}>
        <Ionicons color={colors.textSoft} name={iconName} size={14} />
        <Text style={styles.metaChipLabel}>{label}</Text>
      </View>
      <Text style={styles.metaChipValue}>{value}</Text>
    </View>
  );
}

function FeedbackButton({
  label,
  iconName,
  backgroundColor,
  active,
  disabled,
  onPress
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.feedbackButton,
        { backgroundColor },
        active ? styles.feedbackButtonActive : null,
        disabled ? styles.feedbackButtonDisabled : null,
        pressed && !disabled ? styles.feedbackButtonPressed : null
      ]}
    >
      <Ionicons color={colors.inverseText} name={iconName} size={18} />
      <Text style={styles.feedbackButtonText}>{label}</Text>
    </Pressable>
  );
}

function RingMetricCard({ metric }: { metric: MetricCardMeta }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: metric.softBackground }]}>
      <MetricCardHeader metric={metric} />
      <View style={styles.metricVisualRow}>
        <CircularProgressRing accentColor={metric.accentColor} progress={metric.progress ?? 0} />
        <MetricValueBlock metric={metric} />
      </View>
    </View>
  );
}

function TrendMetricCard({ metric }: { metric: MetricCardMeta }) {
  return (
    <View style={[styles.metricCardWide, { backgroundColor: metric.softBackground }]}>
      <MetricCardHeader metric={metric} />
      <View style={styles.trendMetricBody}>
        <MetricValueBlock metric={metric} />
        <MiniBarChart accentColor={metric.accentColor} values={metric.values ?? []} />
      </View>
    </View>
  );
}

function MetricCardHeader({ metric }: { metric: MetricCardMeta }) {
  return (
    <View style={styles.metricCardHeader}>
      <View style={[styles.metricIconWrap, { backgroundColor: colors.surface }]}>
        <Ionicons color={metric.accentColor} name={metric.iconName} size={18} />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{metric.label}</Text>
        <Text style={styles.metricDescriptor}>{metric.descriptor}</Text>
      </View>
    </View>
  );
}

function MetricValueBlock({ metric }: { metric: MetricCardMeta }) {
  return (
    <View style={styles.metricValueStack}>
      <Text style={styles.metricValueText}>
        {metric.valueText}
        {metric.unitText ? <Text style={styles.metricUnitText}> {metric.unitText}</Text> : null}
      </Text>
      <Text style={styles.metricStatusText}>{metric.statusText}</Text>
      {metric.targetText ? <Text style={styles.metricTargetText}>{metric.targetText}</Text> : null}
    </View>
  );
}

function CircularProgressRing({ progress, accentColor }: { progress: number; accentColor: string }) {
  const size = 78;
  const stroke = 8;
  const clamped = clamp(progress);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.ringWrap}>
      <Svg height={size} width={size}>
        <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke="rgba(16, 35, 59, 0.09)" strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          originX={size / 2}
          originY={size / 2}
          r={radius}
          rotation={-90}
          stroke={accentColor}
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

function MiniBarChart({ values, accentColor }: { values: number[]; accentColor: string }) {
  const fallbackValues = values.length > 0 ? values : [0, 0, 0, 0, 0, 0, 0];
  const maxValue = Math.max(...fallbackValues, 1);

  return (
    <View style={styles.miniBarChart}>
      {fallbackValues.map((value, index) => (
        <View key={`${index}-${value}`} style={styles.miniBarItem}>
          <View style={styles.miniBarTrack}>
            <View
              style={[
                styles.miniBarFill,
                {
                  backgroundColor: accentColor,
                  height: `${Math.max((value / maxValue) * 100, value > 0 ? 12 : 6)}%`,
                  opacity: index === fallbackValues.length - 1 ? 1 : 0.56 + (index / fallbackValues.length) * 0.24
                }
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function WeeklyTrendCard({ bars }: { bars: WeeklyBars }) {
  return (
    <View style={styles.weeklyTrendCard}>
      <View style={styles.weeklyTrendTitleRow}>
        <View style={[styles.metricIconWrap, styles.weeklyIconWrap]}>
          <Ionicons color={colors.primary} name="analytics-outline" size={18} />
        </View>
        <View style={styles.weeklyTrendCopy}>
          <Text style={styles.weeklyTrendTitle}>近 7 日执行趋势</Text>
          <Text style={styles.weeklyTrendDescription}>用微型柱状图快速浏览热量与运动完成度。</Text>
        </View>
      </View>
      <MiniTrendRow accentColor={colors.warning} label="热量达成" values={bars.calorieValues} />
      <MiniTrendRow accentColor={colors.primary} label="运动完成" values={bars.exerciseValues} />
    </View>
  );
}

function MiniTrendRow({
  label,
  values,
  accentColor
}: {
  label: string;
  values: TrendBarDatum[];
  accentColor: string;
}) {
  return (
    <View style={styles.trendRow}>
      <Text style={styles.trendRowLabel}>{label}</Text>
      <View style={styles.trendBars}>
        {values.map((item) => (
          <View key={item.date} style={styles.trendBarItem}>
            <View style={styles.trendBarTrack}>
              <View style={[styles.trendBarFill, { backgroundColor: accentColor, height: `${Math.max(item.progress * 100, 10)}%` }]} />
            </View>
            <Text style={styles.trendBarLabel}>{formatWeekday(item.date).replace("星期", "").replace("周", "")}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ObservationCard({ text }: { text: string }) {
  return (
    <View style={styles.observationCard}>
      <View style={styles.observationHeader}>
        <View style={[styles.metricIconWrap, styles.observationIconWrap]}>
          <Ionicons color={colors.primary} name="shield-checkmark-outline" size={18} />
        </View>
        <View style={styles.observationCopy}>
          <Text style={styles.observationLabel}>系统观察</Text>
          <Text style={styles.observationText}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

function buildCompactAdvice(snapshot: DashboardSnapshot | null) {
  if (!snapshot) {
    return {
      lead: "系统正在整理今日执行建议",
      reason: "同步最近一次对话和监测摘要后，这里会显示压缩后的今日建议。"
    };
  }

  const label = snapshot.adjustment.parameterLabel.toUpperCase();
  const delta = snapshot.adjustment.parameterDelta;
  let lead = snapshot.adjustment.title;

  if (label.includes("CHO")) {
    lead = `今日碳水建议 ${delta}`;
  } else if (label.includes("ACT")) {
    lead = `今日活动时长建议 ${delta}`;
  } else if (label.includes("SLEEP")) {
    lead = `今晚恢复窗口建议 ${delta}`;
  } else if (label.includes("GLU")) {
    lead = `今日血糖控制建议 ${delta}`;
  }

  return {
    lead,
    reason: snapshot.adjustment.summary
  };
}

function resolveAdviceTone(snapshot: DashboardSnapshot | null): AdviceTone {
  if (!snapshot) {
    return {
      iconName: "sparkles-outline",
      iconColor: colors.primary,
      iconBackground: colors.primarySoft,
      panelBackground: colors.backgroundAccent,
      cardBackground: "#F5F9FF",
      chipBackground: colors.primarySoft,
      chipTextColor: colors.primary,
      statusLabel: "等待同步"
    };
  }

  const latestGlucose = getMetricNumber(snapshot, "glucose");
  const latestExercise = getMetricNumber(snapshot, "exercise");
  const latestSteps = getMetricNumber(snapshot, "steps");
  const latestSleep = getMetricNumber(snapshot, "sleep");
  const hasWarningSignal =
    latestGlucose > DEFAULT_GLUCOSE_TARGET ||
    latestExercise < DEFAULT_EXERCISE_TARGET * 0.6 ||
    latestSteps < DEFAULT_STEP_TARGET * 0.7 ||
    latestSleep < 6.5;

  if (hasWarningSignal) {
    return {
      iconName: "alert-circle-outline",
      iconColor: colors.warning,
      iconBackground: "#FCE9D1",
      panelBackground: "#FFF8F0",
      cardBackground: "#FFFDF9",
      chipBackground: "#FCE9D1",
      chipTextColor: colors.warning,
      statusLabel: snapshot.adjustment.feedback === "reject" ? "已记录偏差" : "建议微调"
    };
  }

  return {
    iconName: "checkmark-circle-outline",
    iconColor: colors.success,
    iconBackground: "#DDF0E2",
    panelBackground: "#F4FBF5",
    cardBackground: "#FCFEFC",
    chipBackground: "#DDF0E2",
    chipTextColor: colors.success,
    statusLabel: snapshot.adjustment.feedback === "accept" ? "已采纳" : "稳态执行"
  };
}

function buildMetricCards(snapshot: DashboardSnapshot | null, healthProfile: HealthProfile | null): MetricCardMeta[] {
  const calorieTarget = resolveCalorieTarget(healthProfile);
  const calorieValue = getMetricNumber(snapshot, "calories");
  const exerciseValue = getMetricNumber(snapshot, "exercise");
  const glucoseValue = getMetricNumber(snapshot, "glucose");
  const glucoseSeries = snapshot?.history?.length ? snapshot.history.map((item) => item.glucoseMmol) : [6.8, 7.1, 7.3, 7.0, 7.4, 7.2, 7.1];

  return [
    {
      id: "calories",
      label: "热量",
      descriptor: "今日摄入",
      iconName: "flame-outline",
      accentColor: colors.warning,
      softBackground: colors.warningSoft,
      valueText: formatPrimaryMetric(calorieValue),
      unitText: "kcal",
      statusText: calorieValue >= calorieTarget ? "已接近目标" : `还差 ${Math.max(Math.round(calorieTarget - calorieValue), 0)} kcal`,
      targetText: "",
      progress: clamp(calorieValue / calorieTarget)
    },
    {
      id: "exercise",
      label: "运动时长",
      descriptor: "主动训练",
      iconName: "fitness-outline",
      accentColor: colors.primary,
      softBackground: colors.primarySoft,
      valueText: formatPrimaryMetric(exerciseValue),
      unitText: "min",
      statusText: exerciseValue >= DEFAULT_EXERCISE_TARGET ? "运动达标" : `还差 ${Math.max(Math.round(DEFAULT_EXERCISE_TARGET - exerciseValue), 0)} 分钟`,
      targetText: "",
      progress: clamp(exerciseValue / DEFAULT_EXERCISE_TARGET)
    },
    {
      id: "glucose",
      label: "血糖趋势",
      descriptor: "近 7 日波动",
      iconName: "pulse-outline",
      accentColor: glucoseValue <= DEFAULT_GLUCOSE_TARGET ? colors.success : colors.warning,
      softBackground: glucoseValue <= DEFAULT_GLUCOSE_TARGET ? colors.successSoft : colors.warningSoft,
      valueText: glucoseValue.toFixed(1),
      unitText: "mmol/L",
      statusText: glucoseValue <= DEFAULT_GLUCOSE_TARGET ? "处于目标范围" : `高于目标 ${(glucoseValue - DEFAULT_GLUCOSE_TARGET).toFixed(1)}`,
      targetText: "",
      values: glucoseSeries
    }
  ];
}

function buildWeeklyBars(snapshot: DashboardSnapshot | null): WeeklyBars {
  const focusDate = snapshot?.focusDate ?? getTodayString();
  const history =
    snapshot?.history && snapshot.history.length > 0
      ? snapshot.history
      : Array.from({ length: 7 }, (_, index) => ({
          date: getShiftedDateString(focusDate, index - 6),
          calories: 0,
          exerciseMinutes: 0,
          steps: 0,
          sleepHours: 0,
          glucoseMmol: 0
        }));

  return {
    calorieValues: history.map((item) => ({
      date: item.date,
      progress: clamp(item.calories / DEFAULT_CALORIE_TARGET)
    })),
    exerciseValues: history.map((item) => ({
      date: item.date,
      progress: clamp(item.exerciseMinutes / DEFAULT_EXERCISE_TARGET)
    }))
  };
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

function formatPrimaryMetric(value: number) {
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
    gap: spacing.md
  },
  adjustmentPanel: {
    gap: spacing.lg,
    borderColor: "rgba(217, 150, 71, 0.12)"
  },
  metricsPanel: {
    gap: spacing.lg
  },
  heroPanel: {
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: "rgba(16, 35, 59, 0.08)",
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  heroPanelPressed: {
    opacity: 0.94
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  heroLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  heroEyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800"
  },
  heroReason: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.xs
  },
  parameterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  parameterChipText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: "700"
  },
  heroLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs
  },
  heroLinkText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: "600"
  },
  metricsSection: {
    gap: spacing.sm
  },
  metricsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  metricsHeaderIcon: {
    backgroundColor: colors.primarySoft
  },
  metricsHeaderCopy: {
    gap: 2
  },
  metricsHeaderEyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4
  },
  metricsHeaderTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md
  },
  sectionHeaderMain: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.md
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  sectionCopy: {
    flex: 1,
    gap: spacing.xs
  },
  sectionEyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.titleSmall,
    lineHeight: 30,
    fontWeight: "800"
  },
  sectionDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  sectionTrailing: {
    paddingTop: spacing.xxs
  },
  statusChip: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  statusChipText: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  summaryCard: {
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: "rgba(16, 35, 59, 0.06)",
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  summaryCardPressed: {
    opacity: 0.92
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  summaryTag: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4
  },
  summaryHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  summaryHintText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: "600"
  },
  summaryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metaChip: {
    flex: 1,
    minWidth: 132,
    borderRadius: radii.md,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs
  },
  metaChipLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  metaChipLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  metaChipValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700"
  },
  summaryLead: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 38,
    fontWeight: "800"
  },
  summarySignal: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(255, 255, 255, 0.66)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  summarySignalText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  feedbackRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  feedbackButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.card
  },
  feedbackButtonActive: {
    transform: [{ scale: 0.99 }]
  },
  feedbackButtonDisabled: {
    opacity: 0.6
  },
  feedbackButtonPressed: {
    opacity: 0.9
  },
  feedbackButtonText: {
    color: colors.inverseText,
    fontSize: typography.body,
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
    padding: spacing.sm,
    gap: spacing.sm
  },
  metricCardWide: {
    width: "100%",
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm
  },
  metricCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    alignItems: "center",
    justifyContent: "center"
  },
  metricCopy: {
    flex: 1,
    gap: spacing.xxs
  },
  metricLabel: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  metricDescriptor: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  metricVisualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  trendMetricBody: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md
  },
  metricValueStack: {
    flex: 1,
    gap: spacing.xxs
  },
  metricValueText: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800"
  },
  metricUnitText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: "700"
  },
  metricStatusText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: "700"
  },
  metricTargetText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  ringWrap: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center"
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center"
  },
  ringPercentText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: "800"
  },
  miniBarChart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.xs,
    minHeight: 96
  },
  miniBarItem: {
    flex: 1,
    height: 96,
    justifyContent: "flex-end"
  },
  miniBarTrack: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  miniBarFill: {
    width: "100%",
    borderRadius: radii.pill,
    minHeight: 6
  },
  weeklyTrendCard: {
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.md
  },
  weeklyTrendTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  weeklyIconWrap: {
    backgroundColor: colors.backgroundAccent
  },
  weeklyTrendCopy: {
    flex: 1,
    gap: spacing.xxs
  },
  weeklyTrendTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  weeklyTrendDescription: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20
  },
  trendRow: {
    gap: spacing.sm
  },
  trendRowLabel: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: "700"
  },
  trendBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  trendBarItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs
  },
  trendBarTrack: {
    width: "100%",
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  trendBarFill: {
    width: "100%",
    borderRadius: radii.md,
    minHeight: 10
  },
  trendBarLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  observationCard: {
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md
  },
  observationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  observationIconWrap: {
    backgroundColor: colors.primarySoft
  },
  observationCopy: {
    flex: 1,
    gap: spacing.xs
  },
  observationLabel: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  observationText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  }
});
