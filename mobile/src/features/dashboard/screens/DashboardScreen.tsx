/**
 * 今日仪表盘页面。
 *
 * 页面职责分成三层：
 * 1. 拉取“今日快照”并处理刷新、游客态提示等页面状态。
 * 2. 把原始快照转换成更适合 UI 渲染的卡片元数据。
 * 3. 用一套自绘血糖图表，把历史值和 8 小时预测统一展示出来。
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton, Panel } from "../../../components/clinical";
import { dashboardApi } from "../api/dashboardApi";
import {
  applyLiveStepRecord,
  buildAdviceCard,
  buildMetricCards,
  type GlucoseAxisItem,
  type GlucoseChartMeta,
  type GlucoseRiskTone,
  type MetricCardMeta
} from "../model/dashboardScreenModel";
import { deviceStepCounterApi } from "../../steps/api/deviceStepCounterApi";
import { isAuthExpiredError } from "../../../shared/api/client";
import { subscribeDeviceStepCounterLiveUpdates } from "../../../lib/deviceStepCounter";
import { getTodayString } from "../../../lib/utils";
import { useImmersiveTabBarScroll } from "../../../navigation/ImmersiveTabBarContext";
import { borders, colors, layout, radii, shadows, spacing, typography } from "../../../theme/tokens";
import type { AuthSession, DashboardSnapshot, HealthProfile, StepSyncRecord } from "../../../types";

type DashboardScreenProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  refreshToken: number;
  onOpenAdjustmentDetail: (snapshot: DashboardSnapshot) => void;
  onRequestSignIn: () => void;
};

const GLUCOSE_SAFE_LINE = "#42A08A";
const GLUCOSE_SAFE_FILL = "rgba(66, 160, 138, 0.18)";
const GLUCOSE_WARNING_LINE = "#D4A227";
const GLUCOSE_WARNING_FILL = "rgba(212, 162, 39, 0.22)";
const GLUCOSE_DANGER_LINE = "#D96060";
const GLUCOSE_DANGER_FILL = "rgba(217, 96, 96, 0.24)";
const LIVE_STEP_SYNC_DEBOUNCE_MS = 15_000;

export function DashboardScreen({
  session,
  healthProfile,
  refreshToken,
  onOpenAdjustmentDetail,
  onRequestSignIn
}: DashboardScreenProps) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const liveStepSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLiveStepRecordRef = useRef<StepSyncRecord | null>(null);
  const { bottomInset, onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle } = useImmersiveTabBarScroll();

  useEffect(() => {
    void loadSnapshot(true);
  }, [refreshToken, session?.userId]);

  useEffect(() => {
    // 定时刷新当前时间，让时效性文案和预测标记在不重复拉接口的情况下保持新鲜。
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeDeviceStepCounterLiveUpdates(
      session,
      (record) => {
        pendingLiveStepRecordRef.current = record;
        setSnapshot((current) => applyLiveStepRecord(current, record));

        if (!session) {
          return;
        }

        if (liveStepSyncTimerRef.current) {
          clearTimeout(liveStepSyncTimerRef.current);
        }

        liveStepSyncTimerRef.current = setTimeout(() => {
          liveStepSyncTimerRef.current = null;
          const pendingRecord = pendingLiveStepRecordRef.current;
          if (!pendingRecord) {
            return;
          }

          void deviceStepCounterApi
            .syncLiveDeviceStepCounterRecord(pendingRecord, session)
            .then(() => {
              if (
                pendingLiveStepRecordRef.current?.recordedOn === pendingRecord.recordedOn &&
                pendingLiveStepRecordRef.current?.steps === pendingRecord.steps &&
                pendingLiveStepRecordRef.current?.syncedAt === pendingRecord.syncedAt
              ) {
                pendingLiveStepRecordRef.current = null;
              }
            })
            .catch((error) => {
              if (!isAuthExpiredError(error)) {
                // Live sync is best-effort. Local real-time display should remain responsive.
              }
            });
        }, LIVE_STEP_SYNC_DEBOUNCE_MS);
      }
    );

    return () => {
      unsubscribe();

      if (liveStepSyncTimerRef.current) {
        clearTimeout(liveStepSyncTimerRef.current);
        liveStepSyncTimerRef.current = null;
      }

      const pendingRecord = pendingLiveStepRecordRef.current;
      if (pendingRecord && session) {
        void deviceStepCounterApi.syncLiveDeviceStepCounterRecord(pendingRecord, session).catch(() => undefined);
      }
    };
  }, [session?.userId]);

  async function loadSnapshot(initial = false) {
    // 首次进入和下拉刷新共用一个读取入口，
    // 这样无论数据来自服务端还是本地兜底，页面状态变化都保持一致。
    if (!initial) {
      setRefreshing(true);
    }

    try {
      // 具体读服务端还是本地兜底数据，由 API 层统一决定。
      setSnapshot(await dashboardApi.getDashboardSnapshot(getTodayString()));
    } catch (error) {
      if (!isAuthExpiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshing(false);
    }
  }

  const adviceCard = useMemo(() => buildAdviceCard(snapshot), [snapshot]);
  const metricCards = useMemo(() => buildMetricCards(snapshot, healthProfile, now), [snapshot, healthProfile, now]);

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
            metric.chart ? <GlucoseMetricCard key={metric.id} metric={metric} /> : <RingMetricCard key={metric.id} metric={metric} />
          )}
        </View>

        {!session ? (
          <Panel>
            <View style={styles.syncHeader}>
              <View style={styles.syncBadge}>
                <Ionicons color={colors.primary} name="person-outline" size={16} />
                <Text style={styles.syncBadgeText}>游客模式</Text>
              </View>
              <Text style={styles.syncTitle}>当前正在使用游客数据空间</Text>
              <Text style={styles.syncDescription}>登录后会直接切换到该账号的专属数据，游客数据会继续独立保留，不会混入账号记录。</Text>
            </View>
            <OutlineButton label="登录账号" onPress={onRequestSignIn} variant="ghost" />
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
      <View style={styles.metricBody}>
        <MetricValueBlock metric={metric} />
        <View style={styles.metricRingRow}>
          <CircularProgressRing progress={metric.progress ?? 0} />
        </View>
      </View>
    </View>
  );
}

function GlucoseMetricCard({ metric }: { metric: MetricCardMeta }) {
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

function GlucoseLineChart({ chart }: { chart: GlucoseChartMeta }) {
  const { width: windowWidth } = useWindowDimensions();

  if (chart.kind === "empty") {
    return (
      <View style={styles.glucoseEmptyState}>
        <Ionicons color={colors.textSoft} name="pulse-outline" size={24} />
        <Text style={styles.glucoseEmptyTitle}>{chart.emptyLabel}</Text>
      </View>
    );
  }

  const width = Math.max(280, Math.min(windowWidth - layout.pageHorizontal * 2 - spacing.lg * 2, 420));
  const height = 194;
  const chartPaddingLeft = 10;
  const chartPaddingRight = 36;
  const chartPaddingTop = 12;
  const chartPaddingBottom = 34;
  const maxPointRadius = 5.6;
  const plotInsetX = maxPointRadius + 4;
  const plotInsetY = maxPointRadius + 4;
  const plotLeft = chartPaddingLeft + plotInsetX;
  const plotRight = width - chartPaddingRight - plotInsetX;
  const plotTop = chartPaddingTop + plotInsetY;
  const plotBottom = height - chartPaddingBottom - plotInsetY;
  const availableHeight = Math.max(plotBottom - plotTop, 1);
  const chartRange = Math.max(chart.maxValue - chart.minValue, 0.1);
  const availableWidth = Math.max(plotRight - plotLeft, 1);
  const xRange = Math.max(chart.xMax - chart.xMin, 1);
  const resolveY = (value: number) => plotTop + ((chart.maxValue - value) / chartRange) * availableHeight;
  const resolveX = (xValue: number) => plotLeft + ((xValue - chart.xMin) / xRange) * availableWidth;
  const baselineY = plotBottom;
  const axisItems = sampleXAxisItems(chart.xAxisItems, availableWidth);
  const segments = chart.points.slice(0, -1).map((point, index) => {
    const nextPoint = chart.points[index + 1];
    return {
      id: `${point.xValue}-${nextPoint.xValue}`,
      startPoint: point,
      endPoint: nextPoint,
      tone: resolveGlucoseTone(Math.max(point.value, nextPoint.value))
    };
  });

  return (
    <View style={styles.glucoseChartBlock}>
      <View style={styles.glucoseChartFrame}>
        <Svg height={height} style={styles.glucoseSvg} viewBox={`0 0 ${width} ${height}`} width="100%">
          {chart.yTicks.map((tick) => {
            const y = resolveY(tick);
            return <Line key={`y-grid-${tick}`} stroke="rgba(16, 35, 59, 0.08)" strokeWidth={1} x1={plotLeft} x2={plotRight} y1={y} y2={y} />;
          })}

          {axisItems.map((item) => {
            const x = resolveX(item.value);
            return <Line key={`x-grid-${item.value}`} stroke="rgba(16, 35, 59, 0.03)" strokeWidth={1} x1={x} x2={x} y1={plotTop} y2={plotBottom} />;
          })}

          {segments.map((segment) => {
            const colorsByTone = getGlucoseToneColors(segment.tone);
            return (
              <Path
                key={`area-${segment.id}`}
                d={`M ${resolveX(segment.startPoint.xValue)} ${resolveY(segment.startPoint.value)} L ${resolveX(segment.endPoint.xValue)} ${resolveY(segment.endPoint.value)} L ${resolveX(segment.endPoint.xValue)} ${baselineY} L ${resolveX(segment.startPoint.xValue)} ${baselineY} Z`}
                fill={colorsByTone.fill}
              />
            );
          })}

          {segments.map((segment) => {
            const colorsByTone = getGlucoseToneColors(segment.tone);
            return (
              <Path
                key={`line-${segment.id}`}
                d={`M ${resolveX(segment.startPoint.xValue)} ${resolveY(segment.startPoint.value)} L ${resolveX(segment.endPoint.xValue)} ${resolveY(segment.endPoint.value)}`}
                fill="none"
                stroke={colorsByTone.line}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3.5}
              />
            );
          })}

          {chart.points.map((point, index) => {
            const toneColors = getGlucoseToneColors(resolveGlucoseTone(point.value));
            const isCurrentMarker = point.pointType === "current_marker";

            return (
              <Circle
                key={`point-${index}`}
                cx={resolveX(point.xValue)}
                cy={resolveY(point.value)}
                fill={toneColors.line}
                opacity={isCurrentMarker ? 1 : 0.95}
                r={isCurrentMarker ? 5.6 : point.pointType === "measured_anchor" ? 4.8 : 4.2}
                stroke={isCurrentMarker ? colors.surface : "none"}
                strokeWidth={isCurrentMarker ? 2.2 : 0}
              />
            );
          })}
        </Svg>

        <View
          pointerEvents="none"
          style={[
            styles.glucoseYAxis,
            {
              top: Math.max(plotTop - 8, 0),
              bottom: Math.max(height - plotBottom - 8, 0)
            }
          ]}
        >
          {chart.yTicks.map((tick) => (
            <Text key={`tick-${tick}`} style={styles.glucoseYAxisLabel}>
              {formatGlucoseAxisLabel(tick)}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.glucoseAxisLabels}>
        {axisItems.map((item, index) => (
          <View
            key={`${item.label}-${item.value}`}
            style={[
              styles.glucoseAxisItem,
              { left: `${(resolveX(item.value) / width) * 100}%` },
              index === 0
                ? styles.glucoseAxisItemStart
                : index === axisItems.length - 1
                  ? styles.glucoseAxisItemEnd
                  : styles.glucoseAxisItemCenter
            ]}
          >
            <Text style={styles.glucoseAxisLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatGlucoseAxisLabel(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return `${Math.round(value)}`;
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

function sampleXAxisItems(items: GlucoseAxisItem[], availableWidth: number) {
  if (items.length <= 2) {
    return items;
  }

  const maxLabels = Math.max(2, Math.floor(availableWidth / 74));
  if (items.length <= maxLabels) {
    return items;
  }

  const step = Math.ceil((items.length - 1) / (maxLabels - 1));
  const selected = items.filter((_, index) => index === 0 || index === items.length - 1 || index % step === 0);

  if (selected[selected.length - 1]?.value !== items[items.length - 1]?.value) {
    selected.push(items[items.length - 1]);
  }

  return selected;
}

function resolveGlucoseTone(value: number): GlucoseRiskTone {
  if (value > 13) {
    return "danger";
  }
  if (value > 10) {
    return "warning";
  }
  return "safe";
}

function getGlucoseToneColors(tone: GlucoseRiskTone) {
  if (tone === "danger") {
    return {
      line: GLUCOSE_DANGER_LINE,
      fill: GLUCOSE_DANGER_FILL
    };
  }

  if (tone === "warning") {
    return {
      line: GLUCOSE_WARNING_LINE,
      fill: GLUCOSE_WARNING_FILL
    };
  }

  return {
    line: GLUCOSE_SAFE_LINE,
    fill: GLUCOSE_SAFE_FILL
  };
}

function clamp(value: number, min = 0, max = 1) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.pageHorizontal, paddingTop: layout.pageTop, paddingBottom: layout.pageBottom, gap: spacing.lg },
  heroCard: { borderRadius: radii.lg, borderWidth: borders.standard, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md, ...shadows.card },
  heroCardPressed: { opacity: 0.94 },
  heroHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: 6 },
  heroBadgeText: { color: colors.primary, fontSize: typography.caption, fontWeight: "700" },
  heroTimestamp: { color: colors.textSoft, fontSize: typography.caption },
  heroTitle: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: "800" },
  heroSummary: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  parameterPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: 8 },
  parameterPillText: { color: colors.primary, fontSize: typography.label, fontWeight: "700" },
  detailLink: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  detailLinkText: { color: colors.primary, fontSize: typography.label, fontWeight: "700" },
  sectionHeader: { gap: spacing.xxs },
  sectionEyebrow: { color: colors.textSoft, fontSize: typography.caption, fontWeight: "700", letterSpacing: 0.3 },
  sectionTitle: { color: colors.text, fontSize: typography.titleSmall, lineHeight: 30, fontWeight: "800" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: spacing.sm },
  metricCard: { flexBasis: "48%", minWidth: 154, minHeight: 188, flexGrow: 1, flexShrink: 1, borderRadius: radii.lg, borderWidth: borders.standard, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md, ...shadows.card },
  metricHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  metricIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  metricHeaderCopy: { flex: 1, gap: 2 },
  metricLabel: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: "800" },
  metricDescriptor: { color: colors.textSoft, fontSize: typography.caption, lineHeight: 18 },
  metricBody: { flex: 1, justifyContent: "space-between", gap: spacing.md },
  metricRingRow: { alignItems: "flex-end" },
  metricValueBlock: { gap: spacing.sm },
  metricValueLine: { minHeight: 44, flexDirection: "row", alignItems: "flex-end", flexWrap: "nowrap", gap: spacing.xs },
  metricMetaBlock: { minHeight: 40, gap: 2 },
  metricValueText: { color: colors.text, fontSize: 40, lineHeight: 44, fontWeight: "800", letterSpacing: -0.5, includeFontPadding: false },
  metricUnitText: { color: colors.textSoft, fontSize: typography.caption, lineHeight: 16, fontWeight: "600", paddingBottom: 6, includeFontPadding: false },
  metricStatusText: { color: colors.textMuted, fontSize: typography.label, lineHeight: 20, fontWeight: "600" },
  metricHelperText: { color: colors.textSoft, fontSize: typography.caption, lineHeight: 18 },
  ringWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringPercentText: { color: colors.primary, fontSize: typography.caption, fontWeight: "800" },
  glucoseTrendCard: { width: "100%", borderRadius: 24, borderWidth: borders.standard, borderColor: "#D9E6E7", backgroundColor: "#F4FAFA", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, ...shadows.card },
  glucoseTrendHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  glucoseTrendTitleBlock: { flex: 1, gap: spacing.xxs },
  glucoseTrendTitle: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "900" },
  glucoseTrendSubtitle: { color: colors.textMuted, fontSize: 17, fontWeight: "600" },
  glucoseTrendValueBlock: { maxWidth: "52%", alignItems: "flex-end", gap: spacing.xxs },
  glucoseTrendValueLine: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  glucoseTrendValueText: { color: colors.text, fontSize: 38, lineHeight: 40, fontWeight: "900", letterSpacing: -0.6, includeFontPadding: false },
  glucoseTrendValueUnit: { color: colors.textSoft, fontSize: typography.caption, lineHeight: 16, fontWeight: "700", paddingBottom: 5, includeFontPadding: false },
  glucoseTrendMetaBlock: { alignItems: "flex-end", gap: 2 },
  glucoseTrendStatusText: { color: colors.textMuted, fontSize: typography.label, lineHeight: 20, fontWeight: "600", textAlign: "right" },
  glucoseTrendHelperText: { color: colors.textSoft, fontSize: typography.caption, lineHeight: 18, textAlign: "right" },
  glucoseChartBlock: { gap: spacing.xs },
  glucoseChartFrame: { position: "relative", borderRadius: radii.md, backgroundColor: "transparent", overflow: "hidden" },
  glucoseSvg: { width: "100%" },
  glucoseYAxis: { position: "absolute", top: 12, right: spacing.xs, bottom: 38, width: 24, justifyContent: "space-between", alignItems: "flex-end" },
  glucoseYAxisLabel: { color: colors.text, fontSize: 15, fontWeight: "500" },
  glucoseAxisLabels: { position: "relative", height: 46 },
  glucoseAxisItem: { position: "absolute", top: 0, width: 68 },
  glucoseAxisItemStart: { marginLeft: 0, alignItems: "flex-start" },
  glucoseAxisItemCenter: { marginLeft: -34, alignItems: "center" },
  glucoseAxisItemEnd: { marginLeft: -68, alignItems: "flex-end" },
  glucoseAxisLabel: { color: colors.text, fontSize: 13, fontWeight: "600", transform: [{ rotate: "-32deg" }] },
  glucoseEmptyState: { minHeight: 194, borderRadius: radii.md, borderWidth: borders.standard, borderColor: "rgba(16, 35, 59, 0.08)", backgroundColor: "rgba(255, 255, 255, 0.56)", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  glucoseEmptyTitle: { color: colors.textSoft, fontSize: typography.bodyLarge, fontWeight: "700" },
  glucoseTrendFooter: { color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: "600" },
  syncHeader: { gap: spacing.sm },
  syncBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: 6 },
  syncBadgeText: { color: colors.primary, fontSize: typography.caption, fontWeight: "700" },
  syncTitle: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: "800" },
  syncDescription: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 }
});

