/**
 * 今日仪表盘页面。
 *
 * 页面职责分成三层：
 * 1. 拉取“今日快照”并处理刷新、游客态提示等页面状态。
 * 2. 把原始快照转换成更适合 UI 渲染的卡片元数据。
 * 3. 用一套自绘血糖图表，把历史值和 8 小时预测统一展示出来。
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton, Panel } from "../../components/clinical";
import { api, isAuthExpiredError } from "../../lib/api";
import { formatDateTime, getTodayString, parseLeadingNumber } from "../../lib/utils";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
import { borders, colors, layout, radii, shadows, spacing, typography } from "../../theme/tokens";
import type { AuthSession, DashboardMetric, DashboardSnapshot, GlucoseForecastPoint, HealthProfile, MonitoringHistoryPoint } from "../../types";

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
  chart?: GlucoseChartMeta;
};

type GlucoseChartPoint = {
  label: string;
  value: number;
  pointType?: string;
  xValue: number;
};

type GlucoseAxisItem = {
  value: number;
  label: string;
};

type GlucoseChartSeriesMeta = {
  kind: "series";
  points: GlucoseChartPoint[];
  currentValue: number;
  xMin: number;
  xMax: number;
  minValue: number;
  maxValue: number;
  xAxisItems: GlucoseAxisItem[];
  yTicks: number[];
  footerText: string;
};

type GlucoseChartEmptyMeta = {
  kind: "empty";
  emptyLabel: string;
  footerText: string;
};

type GlucoseChartMeta = GlucoseChartSeriesMeta | GlucoseChartEmptyMeta;
type GlucoseRiskTone = "safe" | "warning" | "danger";

const DEFAULT_CALORIE_TARGET = 1700;
const DEFAULT_EXERCISE_TARGET = 40;
const DEFAULT_STEP_TARGET = 8000;
const GLUCOSE_SAFE_LINE = "#42A08A";
const GLUCOSE_SAFE_FILL = "rgba(66, 160, 138, 0.18)";
const GLUCOSE_WARNING_LINE = "#D4A227";
const GLUCOSE_WARNING_FILL = "rgba(212, 162, 39, 0.22)";
const GLUCOSE_DANGER_LINE = "#D96060";
const GLUCOSE_DANGER_FILL = "rgba(217, 96, 96, 0.24)";
const FORECAST_WINDOW_HOURS = 8;
const FORECAST_HOUR_OFFSET_PRECISION = 2;
const CURRENT_MARKER_SNAP_HOURS = 0.12;

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
  const { bottomInset, onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle } = useImmersiveTabBarScroll();

  useEffect(() => {
    void loadSnapshot(true);
  }, [refreshToken, session?.userId]);

  useEffect(() => {
    // 定时刷新当前时间，让时效性文案和预测标记在不重复拉接口的情况下保持新鲜。
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  async function loadSnapshot(initial = false) {
    // 首次进入和下拉刷新共用一个读取入口，
    // 这样无论数据来自服务端还是本地兜底，页面状态变化都保持一致。
    if (!initial) {
      setRefreshing(true);
    }

    try {
      // 具体读服务端还是本地兜底数据，由 API 层统一决定。
      setSnapshot(await api.getDashboardSnapshot(getTodayString()));
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

function buildAdviceCard(snapshot: DashboardSnapshot | null) {
  if (!snapshot) {
    return {
      title: "系统正在生成今日方案",
      summary: "整理最近的对话和监测摘要后，这里会展示压缩后的今日建议。",
      parameter: "处理中",
      timestamp: "更新中"
    };
  }

  const normalizedLabel = snapshot.adjustment.parameterLabel.toUpperCase();
  let title = snapshot.adjustment.title;
  if (normalizedLabel.includes("CHO")) {
    title = `今日碳水建议 ${snapshot.adjustment.parameterDelta}`;
  } else if (normalizedLabel.includes("ACT")) {
    title = `今日活动时长建议 ${snapshot.adjustment.parameterDelta}`;
  } else if (normalizedLabel.includes("SLEEP")) {
    title = `今晚恢复窗口建议 ${snapshot.adjustment.parameterDelta}`;
  }

  return {
    title,
    summary: snapshot.adjustment.summary,
    parameter: `${snapshot.adjustment.parameterLabel} ${snapshot.adjustment.parameterDelta}`,
    timestamp: formatDateTime(snapshot.adjustment.generatedAt)
  };
}

function buildMetricCards(snapshot: DashboardSnapshot | null, healthProfile: HealthProfile | null, now: Date): MetricCardMeta[] {
  // 这里把后端/本地快照转成纯 UI 模型，
  // 避免 JSX 内部到处散落“取值 + 容错 + 格式化”逻辑。
  const calorieTarget = resolveCalorieTarget(healthProfile);
  const calorieValue = getMetricNumber(snapshot, "calories");
  const exerciseValue = getMetricNumber(snapshot, "exercise");
  const stepsValue = getMetricNumber(snapshot, "steps");
  const stepsSource = findMetric(snapshot, "steps")?.source || "连接设备步数后自动同步";
  const glucoseChart = buildGlucoseChart(snapshot, now);
  const hasGlucoseData = glucoseChart.kind === "series";
  const hasForecast = hasGlucoseForecast(snapshot);
  const hasRecordedHistory = getRecordedGlucoseHistory(snapshot).length > 0;

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
      id: "steps",
      label: "步数",
      descriptor: "全天活动",
      iconName: "walk-outline",
      valueText: formatMetricInteger(stepsValue),
      unitText: "步",
      statusText: stepsValue >= DEFAULT_STEP_TARGET ? "已达到今日建议" : `还需 ${Math.max(DEFAULT_STEP_TARGET - stepsValue, 0)} 步`,
      helperText: stepsSource,
      progress: clamp(stepsValue / DEFAULT_STEP_TARGET)
    },
    {
      id: "glucose",
      label: hasForecast ? "血糖 8h 趋势" : "血糖趋势",
      descriptor: hasGlucoseData ? (hasForecast ? resolveForecastSourceLabel(snapshot) : hasRecordedHistory ? "近 7 天实测记录" : "最新血糖记录") : "暂无血糖数据",
      iconName: "pulse-outline",
      valueText: hasGlucoseData ? glucoseChart.currentValue.toFixed(1) : "--",
      unitText: "mmol/L",
      statusText: hasGlucoseData && snapshot?.glucoseRiskLevel ? `风险 ${snapshot.glucoseRiskLevel}` : hasGlucoseData ? "已展示实测相关曲线" : "暂无数据",
      helperText: hasGlucoseData ? (snapshot?.calibrationApplied ? "已按最新实测值更新" : "") : "记录血糖后自动展示曲线",
      chart: glucoseChart
    }
  ];
}

function buildGlucoseChart(snapshot: DashboardSnapshot | null, now: Date): GlucoseChartMeta {
  // 血糖卡片优先展示预测；没有预测时再退回历史记录；
  // 两者都没有时才进入空态。
  const forecast = getGlucoseForecast(snapshot);
  if (forecast.length > 0) {
    return buildForecastChart(snapshot, forecast, now);
  }

  const recordedHistory = getRecordedGlucoseHistory(snapshot);
  if (recordedHistory.length > 0) {
    return buildHistoryChart(recordedHistory);
  }

  return {
    kind: "empty",
    emptyLabel: "暂无数据",
    footerText: "记录血糖后，这里会展示实际趋势和风险区间。"
  };
}

function resolveForecastSourceLabel(snapshot: DashboardSnapshot | null) {
  if (snapshot?.forecastSource === "dify") {
    return "按实测值生成的 8 小时预测";
  }
  if (snapshot?.forecastSource === "local") {
    return "按实测值延展的本地趋势";
  }
  return findMetric(snapshot, "glucose")?.source || "实测记录";
}

function hasGlucoseForecast(snapshot: DashboardSnapshot | null) {
  return getGlucoseForecast(snapshot).length > 0;
}

function getGlucoseForecast(snapshot: DashboardSnapshot | null) {
  const dedupedForecast = new Map<number, GlucoseForecastPoint>();

  for (const point of snapshot?.glucoseForecast8h ?? []) {
    if (!Number.isFinite(point.hourOffset) || !Number.isFinite(point.predictedGlucoseMmol)) {
      continue;
    }

    const normalizedHourOffset = normalizeForecastHourOffset(point.hourOffset);
    const normalizedPoint: GlucoseForecastPoint = {
      ...point,
      hourOffset: normalizedHourOffset,
      predictedGlucoseMmol: roundChartValue(point.predictedGlucoseMmol)
    };
    const existingPoint = dedupedForecast.get(normalizedHourOffset);

    if (!existingPoint || shouldReplaceForecastPoint(existingPoint, normalizedPoint)) {
      dedupedForecast.set(normalizedHourOffset, normalizedPoint);
    }
  }

  return [...dedupedForecast.values()].sort((left, right) => left.hourOffset - right.hourOffset);
}

function buildForecastChart(snapshot: DashboardSnapshot | null, forecast: GlucoseForecastPoint[], now: Date): GlucoseChartSeriesMeta {
  // 预测图除了展示未来点位，还会把“当前时刻”插回曲线里，
  // 让用户更容易理解自己处在这条 8 小时曲线的哪个位置。
  const sorted = [...forecast].sort((left, right) => left.hourOffset - right.hourOffset);
  const forecastStart = resolveForecastStartTime(snapshot, now);
  const lastHour = Math.max(...sorted.map((point) => point.hourOffset), 0);
  const basePoints = sorted.map((point) => ({
    label: formatClockLabel(addHours(forecastStart, point.hourOffset)),
    value: roundChartValue(point.predictedGlucoseMmol),
    pointType: point.pointType,
    xValue: point.hourOffset
  }));
  const liveSeries = insertCurrentGlucosePoint(basePoints, resolveElapsedHours(forecastStart, now), formatClockLabel(now));
  const values = liveSeries.points.map((point) => point.value);
  const ticks = buildYAxisTicks(values);

  return {
    kind: "series",
    points: liveSeries.points,
    currentValue: liveSeries.currentValue,
    xMin: 0,
    xMax: lastHour,
    minValue: ticks[ticks.length - 1],
    maxValue: ticks[0],
    xAxisItems: basePoints.map((point) => ({ value: point.xValue, label: point.label })),
    yTicks: ticks,
    footerText: buildForecastFooter(snapshot, values, forecastStart)
  };
}

function getRecordedGlucoseHistory(snapshot: DashboardSnapshot | null) {
  return (snapshot?.history ?? []).filter(
    (item): item is MonitoringHistoryPoint & { glucoseMmol: number } =>
      item.glucoseSource === "recorded" && typeof item.glucoseMmol === "number" && Number.isFinite(item.glucoseMmol)
  );
}

function buildHistoryChart(history: Array<MonitoringHistoryPoint & { glucoseMmol: number }>): GlucoseChartSeriesMeta {
  const points = history.map((item, index) => ({
    label: formatHistoryAxisLabel(item.date),
    value: Number(item.glucoseMmol.toFixed(1)),
    pointType: index === history.length - 1 ? "measured_anchor" : "forecast",
    xValue: index
  }));
  const values = points.map((item) => item.value);
  const ticks = buildYAxisTicks(values);

  return {
    kind: "series",
    points,
    currentValue: points[points.length - 1]?.value ?? 0,
    xMin: 0,
    xMax: Math.max(points.length - 1, 0),
    minValue: ticks[ticks.length - 1],
    maxValue: ticks[0],
    xAxisItems: points.map((point) => ({ value: point.xValue, label: point.label })),
    yTicks: ticks,
    footerText: buildHistoryFooter(values, history.length)
  };
}

function formatHistoryAxisLabel(date: string) {
  const [, month = "0", day = "0"] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function buildHistoryFooter(values: number[], sampleCount: number) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return `近 ${sampleCount} 次实测，均值 ${average(values).toFixed(1)} mmol/L，波动 ${(maxValue - minValue).toFixed(1)}。`;
}

function buildForecastFooter(snapshot: DashboardSnapshot | null, values: number[], forecastStart: Date) {
  const parts = [`均值 ${average(values).toFixed(1)} mmol/L`];
  if (snapshot?.glucoseRiskLevel) {
    parts.push(`风险 ${snapshot.glucoseRiskLevel}`);
  }
  if (typeof snapshot?.peakGlucoseMmol === "number") {
    const peakTime = typeof snapshot?.peakHourOffset === "number" ? `（${formatClockLabel(addHours(forecastStart, snapshot.peakHourOffset))}）` : "";
    parts.push(`峰值 ${snapshot.peakGlucoseMmol.toFixed(1)}${peakTime}`);
  }
  if (typeof snapshot?.returnToBaselineHourOffset === "number") {
    parts.push(`约 ${formatClockLabel(addHours(forecastStart, snapshot.returnToBaselineHourOffset))} 回到基线`);
  }
  return parts.join("，") + "。";
}

function buildYAxisTicks(values: number[]) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 0.3);
  const padding = Math.max(range * 0.18, 0.2);
  const rawMin = Math.max(0, minValue - padding);
  const rawMax = maxValue + padding;
  const targetTickCount = range < 1.2 ? 5 : 4;
  const step = resolveGlucoseAxisStep(rawMax - rawMin, targetTickCount);
  const bottom = Math.floor(rawMin / step) * step;
  const top = Math.ceil(rawMax / step) * step;
  const tickCount = Math.max(2, Math.round((top - bottom) / step) + 1);

  return Array.from({ length: tickCount }, (_, index) => roundAxisNumber(top - index * step));
}

function resolveGlucoseAxisStep(range: number, targetTickCount: number) {
  const rawStep = range / Math.max(targetTickCount - 1, 1);
  const normalizedCandidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5];
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawStep, 0.01)));
  const candidateSteps = Array.from(
    new Set(
      [-1, 0, 1].flatMap((offset) => {
        const scaledMagnitude = magnitude * 10 ** offset;
        return normalizedCandidates.map((candidate) => candidate * scaledMagnitude);
      })
    )
  )
    .filter((candidate) => candidate > 0)
    .sort((left, right) => left - right);

  const bestStep =
    candidateSteps.reduce<{ step: number; score: number } | null>((best, candidate) => {
      const tickCount = range / candidate + 1;
      if (tickCount < 3 || tickCount > 6) {
        return best;
      }

      const tickCountScore = Math.abs(tickCount - targetTickCount);
      const stepScore = Math.abs(candidate - rawStep) / rawStep;
      const score = tickCountScore * 3 + stepScore;

      if (!best || score < best.score) {
        return { step: candidate, score };
      }

      return best;
    }, null)?.step ?? rawStep;

  return bestStep;
}

function roundAxisNumber(value: number) {
  return Number(value.toFixed(2));
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

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundChartValue(value: number) {
  return Number(value.toFixed(1));
}

function addHours(base: Date, hourOffset: number) {
  return new Date(base.getTime() + hourOffset * 60 * 60 * 1000);
}

function parseSnapshotTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveForecastStartTime(snapshot: DashboardSnapshot | null, fallback: Date) {
  return parseSnapshotTime(snapshot?.adjustment.generatedAt) ?? parseSnapshotTime(snapshot?.refreshedAt) ?? fallback;
}

function resolveElapsedHours(start: Date, now: Date) {
  return (now.getTime() - start.getTime()) / (60 * 60 * 1000);
}

function formatClockLabel(value: Date) {
  return `${`${value.getHours()}`.padStart(2, "0")}:${`${value.getMinutes()}`.padStart(2, "0")}`;
}

function insertCurrentGlucosePoint(points: GlucoseChartPoint[], currentX: number, currentLabel: string) {
  // 当前时刻并不一定正好落在预测采样点上，
  // 所以这里会把它吸附到最近的点位或插入到两点之间，保证图上有明确当前位置。
  if (points.length === 0) {
    return {
      points,
      currentValue: 0
    };
  }

  const firstX = points[0].xValue;
  const lastX = points[points.length - 1].xValue;
  const clampedX = clamp(currentX, firstX, lastX);
  const nearestIndex = findNearestGlucosePointIndex(points, clampedX);
  const snapTolerance = resolveCurrentMarkerSnapHours(points);

  if (nearestIndex >= 0 && Math.abs(points[nearestIndex].xValue - clampedX) <= snapTolerance) {
    return {
      points: points.map((point, index) =>
        index === nearestIndex
          ? {
              ...point,
              label: currentLabel,
              pointType: "current_marker"
            }
          : point
      ),
      currentValue: points[nearestIndex].value
    };
  }

  if (clampedX <= firstX) {
    return {
      points: [{ ...points[0], label: currentLabel, pointType: "current_marker" }, ...points.slice(1)],
      currentValue: points[0].value
    };
  }

  if (clampedX >= lastX) {
    return {
      points: [...points.slice(0, -1), { ...points[points.length - 1], label: currentLabel, pointType: "current_marker" }],
      currentValue: points[points.length - 1].value
    };
  }

  const insertionIndex = points.findIndex((point) => point.xValue > clampedX);
  const previousPoint = points[insertionIndex - 1];
  const nextPoint = points[insertionIndex];
  const ratio = (clampedX - previousPoint.xValue) / Math.max(nextPoint.xValue - previousPoint.xValue, 0.001);
  const currentValue = roundChartValue(previousPoint.value + (nextPoint.value - previousPoint.value) * ratio);
  const currentPoint: GlucoseChartPoint = {
    label: currentLabel,
    value: currentValue,
    pointType: "current_marker",
    xValue: clampedX
  };

  return {
    points: [...points.slice(0, insertionIndex), currentPoint, ...points.slice(insertionIndex)],
    currentValue
  };
}

function normalizeForecastHourOffset(hourOffset: number) {
  return Number(clamp(hourOffset, 0, FORECAST_WINDOW_HOURS).toFixed(FORECAST_HOUR_OFFSET_PRECISION));
}

function shouldReplaceForecastPoint(existingPoint: GlucoseForecastPoint, nextPoint: GlucoseForecastPoint) {
  const existingPriority = resolveForecastPointPriority(existingPoint.pointType);
  const nextPriority = resolveForecastPointPriority(nextPoint.pointType);

  if (existingPriority !== nextPriority) {
    return nextPriority > existingPriority;
  }

  return true;
}

function resolveForecastPointPriority(pointType?: string) {
  if (pointType === "measured_anchor") {
    return 2;
  }
  if (pointType === "forecast") {
    return 1;
  }
  return 0;
}

function findNearestGlucosePointIndex(points: GlucoseChartPoint[], targetX: number) {
  return points.reduce(
    (bestIndex, point, index, collection) => {
      if (bestIndex < 0) {
        return index;
      }

      const bestDistance = Math.abs(collection[bestIndex].xValue - targetX);
      const nextDistance = Math.abs(point.xValue - targetX);
      return nextDistance < bestDistance ? index : bestIndex;
    },
    -1
  );
}

function resolveCurrentMarkerSnapHours(points: GlucoseChartPoint[]) {
  if (points.length < 2) {
    return CURRENT_MARKER_SNAP_HOURS;
  }

  const smallestGap = points.slice(1).reduce((bestGap, point, index) => {
    const gap = Math.abs(point.xValue - points[index].xValue);
    if (gap <= 0.001) {
      return bestGap;
    }
    if (bestGap === null || gap < bestGap) {
      return gap;
    }
    return bestGap;
  }, null as number | null);

  if (smallestGap == null) {
    return CURRENT_MARKER_SNAP_HOURS;
  }

  return Math.min(CURRENT_MARKER_SNAP_HOURS, smallestGap / 3);
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
