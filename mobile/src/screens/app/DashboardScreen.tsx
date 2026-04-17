import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton, Panel } from "../../components/clinical";
import { api } from "../../lib/api";
import { formatDateTime, getTodayString, parseLeadingNumber } from "../../lib/utils";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
import { borders, colors, layout, radii, shadows, spacing, typography } from "../../theme/tokens";
import type { AuthSession, DashboardMetric, DashboardSnapshot, GlucoseForecastPoint, HealthProfile } from "../../types";

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

type GlucoseChartMeta = {
  points: GlucoseChartPoint[];
  currentValue: number;
  xMin: number;
  xMax: number;
  minValue: number;
  maxValue: number;
  splitIndex: number;
  xLabels: string[];
  yTicks: number[];
  markerValues: number[];
  footerText: string;
};

const DEFAULT_CALORIE_TARGET = 1700;
const DEFAULT_EXERCISE_TARGET = 40;
const DEFAULT_GLUCOSE_TARGET = 7.2;
const GLUCOSE_LEFT_LINE = "#8FD7CA";
const GLUCOSE_LEFT_FILL = "rgba(143, 215, 202, 0.18)";
const GLUCOSE_RIGHT_LINE = "#F3B9A7";
const GLUCOSE_RIGHT_FILL = "rgba(244, 212, 136, 0.20)";
const GLUCOSE_ANCHOR_TEMPLATE = [6.7, 5.3, 4.5, 5.4, 6.4, 7.2, 7.9, 6.6, 6.3, 5.2, 6.1, 7.1, 7.6] as const;

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
  }, [refreshToken]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

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
        <Text style={styles.glucoseTrendUnit}>{metric.unitText}</Text>
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
      <Text style={styles.metricValueText}>
        {metric.valueText}
        {metric.unitText ? <Text style={styles.metricUnitText}> {metric.unitText}</Text> : null}
      </Text>
      {metric.statusText ? <Text style={styles.metricStatusText}>{metric.statusText}</Text> : null}
      {metric.helperText ? <Text style={styles.metricHelperText}>{metric.helperText}</Text> : null}
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
  const width = 340;
  const height = 178;
  const chartPaddingLeft = 10;
  const chartPaddingRight = 36;
  const chartPaddingTop = 12;
  const chartPaddingBottom = 22;
  const availableHeight = height - chartPaddingTop - chartPaddingBottom;
  const chartRange = Math.max(chart.maxValue - chart.minValue, 0.1);
  const availableWidth = width - chartPaddingLeft - chartPaddingRight;
  const xRange = Math.max(chart.xMax - chart.xMin, 1);
  const resolveY = (value: number) => chartPaddingTop + ((chart.maxValue - value) / chartRange) * availableHeight;
  const resolveX = (xValue: number) => chartPaddingLeft + ((xValue - chart.xMin) / xRange) * availableWidth;
  const baselineY = resolveY(chart.minValue);
  const lastIndex = chart.points.length - 1;
  const splitIndex = Math.max(0, Math.min(chart.splitIndex, lastIndex));
  const hasRightSegment = splitIndex < lastIndex;

  const buildSegmentPath = (startIndex: number, endIndex: number) =>
    chart.points
      .slice(startIndex, endIndex + 1)
      .map((point, offset) => `${offset === 0 ? "M" : "L"} ${resolveX(point.xValue)} ${resolveY(point.value)}`)
      .join(" ");

  const buildSegmentAreaPath = (startIndex: number, endIndex: number) => {
    const linePath = buildSegmentPath(startIndex, endIndex);
    return `${linePath} L ${resolveX(chart.points[endIndex].xValue)} ${baselineY} L ${resolveX(chart.points[startIndex].xValue)} ${baselineY} Z`;
  };

  return (
    <View style={styles.glucoseChartBlock}>
      <View style={styles.glucoseChartFrame}>
        <Svg height={height} style={styles.glucoseSvg} viewBox={`0 0 ${width} ${height}`} width="100%">
          <Defs>
            <LinearGradient id="glucoseLeftFill" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%" stopColor={GLUCOSE_LEFT_FILL} />
              <Stop offset="100%" stopColor="rgba(143, 215, 202, 0.06)" />
            </LinearGradient>
            <LinearGradient id="glucoseRightFill" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%" stopColor={GLUCOSE_RIGHT_FILL} />
              <Stop offset="100%" stopColor="rgba(244, 212, 136, 0.06)" />
            </LinearGradient>
          </Defs>

          {chart.yTicks.map((tick) => {
            const y = resolveY(tick);
            return <Line key={`y-grid-${tick}`} stroke="rgba(16, 35, 59, 0.08)" strokeWidth={1} x1={chartPaddingLeft} x2={resolveX(chart.xMax)} y1={y} y2={y} />;
          })}

          {chart.markerValues.map((value) => {
            const x = resolveX(value);
            return <Line key={`x-grid-${value}`} stroke="rgba(16, 35, 59, 0.03)" strokeWidth={1} x1={x} x2={x} y1={chartPaddingTop} y2={chartPaddingTop + availableHeight} />;
          })}

          <Path d={buildSegmentAreaPath(0, splitIndex)} fill="url(#glucoseLeftFill)" />
          {hasRightSegment ? <Path d={buildSegmentAreaPath(splitIndex, lastIndex)} fill="url(#glucoseRightFill)" /> : null}
          <Path d={buildSegmentPath(0, splitIndex)} fill="none" stroke={GLUCOSE_LEFT_LINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} />
          {hasRightSegment ? (
            <Path d={buildSegmentPath(splitIndex, lastIndex)} fill="none" stroke={GLUCOSE_RIGHT_LINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} />
          ) : null}

          {chart.points.map((point, index) => (
            <Circle
              key={`point-${index}`}
              cx={resolveX(point.xValue)}
              cy={resolveY(point.value)}
              fill={point.pointType === "current_marker" ? colors.primary : index <= splitIndex ? GLUCOSE_LEFT_LINE : GLUCOSE_RIGHT_LINE}
              opacity={point.pointType === "current_marker" ? 1 : 0.9}
              r={point.pointType === "current_marker" ? 5.4 : point.pointType === "measured_anchor" ? 4.8 : 4.2}
              stroke={point.pointType === "current_marker" ? colors.surface : "none"}
              strokeWidth={point.pointType === "current_marker" ? 2.2 : 0}
            />
          ))}
        </Svg>

        <View pointerEvents="none" style={styles.glucoseYAxis}>
          {chart.yTicks.map((tick) => (
            <Text key={`tick-${tick}`} style={styles.glucoseYAxisLabel}>
              {tick}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.glucoseAxisLabels}>
        {chart.xLabels.map((label, index) => (
          <Text
            key={`${label}-${chart.markerValues[index] ?? index}`}
            style={[
              styles.glucoseAxisLabel,
              { left: `${(resolveX(chart.markerValues[index] ?? chart.xMin) / width) * 100}%` },
              index === 0
                ? styles.glucoseAxisLabelStart
                : index === chart.xLabels.length - 1
                  ? styles.glucoseAxisLabelEnd
                  : styles.glucoseAxisLabelCenter
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function buildAdviceCard(snapshot: DashboardSnapshot | null) {
  if (!snapshot) {
    return {
      title: "系统正在生成今日方案",
      summary: "同步最近的对话和监测摘要后，这里会展示压缩后的今日建议。",
      parameter: "等待同步",
      timestamp: "同步中"
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
  const calorieTarget = resolveCalorieTarget(healthProfile);
  const calorieValue = getMetricNumber(snapshot, "calories");
  const exerciseValue = getMetricNumber(snapshot, "exercise");
  const glucoseChart = buildGlucoseChart(snapshot, healthProfile, now);
  const glucoseValue = glucoseChart.currentValue || getMetricNumber(snapshot, "glucose");
  const hasForecast = Boolean(snapshot?.glucoseForecast8h?.length);
  const glucoseSource = resolveForecastSourceLabel(snapshot);

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
      label: hasForecast ? "血糖 8h 预测" : "血糖趋势",
      descriptor: hasForecast ? glucoseSource : "基于最近记录生成",
      iconName: "pulse-outline",
      valueText: glucoseValue > 0 ? glucoseValue.toFixed(1) : "--",
      unitText: "mmol/L",
      statusText: snapshot?.glucoseRiskLevel ? `风险 ${snapshot.glucoseRiskLevel}` : "",
      helperText: snapshot?.calibrationApplied ? "已按最新实测值校准" : "",
      chart: glucoseChart
    }
  ];
}

function buildGlucoseChart(snapshot: DashboardSnapshot | null, healthProfile: HealthProfile | null, now: Date): GlucoseChartMeta {
  const forecast = snapshot?.glucoseForecast8h?.filter((point) => Number.isFinite(point.predictedGlucoseMmol)) ?? [];
  if (forecast.length > 0) {
    return buildForecastChart(snapshot, forecast, now);
  }
  const recordedHistory = getRecordedGlucoseHistory(snapshot);
  if (recordedHistory.length > 0) {
    return buildHistoryChart(recordedHistory);
  }
  return buildSyntheticChart(snapshot, healthProfile, now);
}

function resolveForecastSourceLabel(snapshot: DashboardSnapshot | null) {
  if (snapshot?.forecastSource === "dify") {
    return "Dify 工作流";
  }
  if (snapshot?.forecastSource === "local") {
    return snapshot.calibrationApplied ? "规则模拟（已校准）" : "规则模拟";
  }
  return findMetric(snapshot, "glucose")?.source || "基于最近记录生成";
}

function buildForecastChart(snapshot: DashboardSnapshot | null, forecast: GlucoseForecastPoint[], now: Date): GlucoseChartMeta {
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
  const values = basePoints.map((point) => point.value);
  const ticks = buildYAxisTicks(liveSeries.points.map((point) => point.value));
  const markerValues = buildForecastMarkerValues(sorted);

  return {
    points: liveSeries.points,
    currentValue: liveSeries.currentValue,
    xMin: 0,
    xMax: lastHour,
    minValue: ticks[ticks.length - 1],
    maxValue: ticks[0],
    splitIndex: liveSeries.splitIndex,
    xLabels: buildForecastXAxisLabels(markerValues, forecastStart),
    yTicks: ticks,
    markerValues,
    footerText: buildForecastFooter(snapshot, values, forecastStart)
  };
}

function getRecordedGlucoseHistory(snapshot: DashboardSnapshot | null) {
  return (snapshot?.history ?? []).filter(
    (item) => item.glucoseSource === "recorded" && Number.isFinite(item.glucoseMmol)
  );
}

function buildHistoryChart(history: DashboardSnapshot["history"]): GlucoseChartMeta {
  const points = history.map((item, index) => ({
    label: formatHistoryAxisLabel(item.date),
    value: Number(item.glucoseMmol.toFixed(1)),
    pointType: "measured_anchor",
    xValue: index
  }));
  const values = points.map((item) => item.value);
  const ticks = buildYAxisTicks(values);
  const markerValues = buildHistoryMarkerValues(history);

  return {
    points,
    currentValue: points[points.length - 1]?.value ?? DEFAULT_GLUCOSE_TARGET,
    xMin: 0,
    xMax: Math.max(points.length - 1, 0),
    minValue: ticks[ticks.length - 1],
    maxValue: ticks[0],
    splitIndex: points.length - 1,
    xLabels: buildHistoryXAxisLabels(history, markerValues),
    yTicks: ticks,
    markerValues,
    footerText: buildHistoryFooter(values, history.length)
  };
}

function buildSyntheticChart(snapshot: DashboardSnapshot | null, healthProfile: HealthProfile | null, now: Date): GlucoseChartMeta {
  const historyValues = getRecordedGlucoseHistory(snapshot).map((item) => item.glucoseMmol);
  const currentValue = getMetricNumber(snapshot, "glucose") || parseLeadingNumber(healthProfile?.fastingGlucoseBaseline) || DEFAULT_GLUCOSE_TARGET;
  const recentAverage = historyValues.length > 0 ? average(historyValues) : average(Array.from(GLUCOSE_ANCHOR_TEMPLATE));
  const averageOffset = clamp(recentAverage - average(Array.from(GLUCOSE_ANCHOR_TEMPLATE)), -0.45, 0.45);
  const currentOffset = clamp(currentValue - DEFAULT_GLUCOSE_TARGET, -0.55, 0.75);
  const anchorValues = GLUCOSE_ANCHOR_TEMPLATE.map((value, index) => {
    const influence = index >= 5 && index <= 8 ? 0.8 : 0.55;
    return clamp(value + averageOffset + currentOffset * influence, 3.8, 8.6);
  });
  const basePoints = anchorValues.map((value, index) => ({
    label: formatDayHourLabel(index * 2),
    value: roundChartValue(value),
    pointType: index === 0 ? "measured_anchor" : "forecast",
    xValue: index * 2
  }));
  const liveSeries = insertCurrentGlucosePoint(basePoints, resolveCurrentHourOfDay(now), formatClockLabel(now));
  const ticks = buildYAxisTicks(liveSeries.points.map((point) => point.value));
  const range = Math.max(...anchorValues) - Math.min(...anchorValues);
  const markerValues = [0, 4, 8, 12, 16, 24];

  return {
    points: liveSeries.points,
    currentValue: liveSeries.currentValue,
    xMin: 0,
    xMax: 24,
    minValue: ticks[ticks.length - 1],
    maxValue: ticks[0],
    splitIndex: liveSeries.splitIndex,
    xLabels: markerValues.map((value) => formatDayHourLabel(value)),
    yTicks: ticks,
    markerValues,
    footerText: `均值 ${average(anchorValues).toFixed(1)} mmol/L，${range <= 1.8 ? "趋势稳定" : range <= 2.6 ? "轻微波动" : "波动偏大"}。`
  };
}

function formatHistoryAxisLabel(date: string) {
  const [, month = "0", day = "0"] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function buildHistoryMarkerValues(history: DashboardSnapshot["history"]) {
  if (history.length <= 4) {
    return history.map((_, index) => index);
  }

  return Array.from(new Set([0, Math.round((history.length - 1) / 3), Math.round(((history.length - 1) * 2) / 3), history.length - 1])).sort(
    (left, right) => left - right
  );
}

function buildHistoryXAxisLabels(history: DashboardSnapshot["history"], markerValues: number[]) {
  return markerValues.map((index) => formatHistoryAxisLabel(history[index].date));
}

function buildHistoryFooter(values: number[], sampleCount: number) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return `近 ${sampleCount} 次实测，均值 ${average(values).toFixed(1)} mmol/L，波动 ${(
    maxValue - minValue
  ).toFixed(1)}。`;
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
  if (snapshot?.calibrationApplied) {
    parts.push("已校准");
  }
  return parts.join("，") + "。";
}

function buildForecastMarkerValues(forecast: GlucoseForecastPoint[]) {
  const lastHour = Math.max(...forecast.map((point) => point.hourOffset), 0);
  return Array.from(new Set([0, Math.round(lastHour / 4), Math.round(lastHour / 2), Math.round((lastHour * 3) / 4), lastHour])).sort(
    (left, right) => left - right
  );
}

function buildForecastXAxisLabels(markerValues: number[], forecastStart: Date) {
  return markerValues.map((hour) => formatClockLabel(addHours(forecastStart, hour)));
}

function buildYAxisTicks(values: number[]) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const step = Math.max(1, Math.ceil((maxValue - minValue + 1.2) / 3));
  const bottom = Math.max(3, Math.floor(minValue) - 1);
  const top = Math.max(bottom + step * 3, Math.ceil(maxValue) + 1);
  return [top, top - step, top - step * 2, top - step * 3];
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

function resolveCurrentHourOfDay(now: Date) {
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

function formatClockLabel(value: Date) {
  return `${`${value.getHours()}`.padStart(2, "0")}:${`${value.getMinutes()}`.padStart(2, "0")}`;
}

function formatDayHourLabel(hourValue: number) {
  return `${`${Math.round(hourValue)}`.padStart(2, "0")}:00`;
}

function insertCurrentGlucosePoint(points: GlucoseChartPoint[], currentX: number, currentLabel: string) {
  if (points.length === 0) {
    return {
      points,
      splitIndex: 0,
      currentValue: DEFAULT_GLUCOSE_TARGET
    };
  }

  const firstX = points[0].xValue;
  const lastX = points[points.length - 1].xValue;
  const clampedX = clamp(currentX, firstX, lastX);
  const exactIndex = points.findIndex((point) => Math.abs(point.xValue - clampedX) < 0.001);

  if (exactIndex >= 0) {
    return {
      points: points.map((point, index) =>
        index === exactIndex
          ? {
              ...point,
              label: currentLabel,
              pointType: "current_marker"
            }
          : point
      ),
      splitIndex: exactIndex,
      currentValue: points[exactIndex].value
    };
  }

  if (clampedX <= firstX) {
    return {
      points: [{ ...points[0], label: currentLabel, pointType: "current_marker" }, ...points.slice(1)],
      splitIndex: 0,
      currentValue: points[0].value
    };
  }

  if (clampedX >= lastX) {
    return {
      points: [...points.slice(0, -1), { ...points[points.length - 1], label: currentLabel, pointType: "current_marker" }],
      splitIndex: points.length - 1,
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
    splitIndex: insertionIndex,
    currentValue
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
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metricCard: { width: "48%", minWidth: 154, flexGrow: 1, borderRadius: radii.lg, borderWidth: borders.standard, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md, ...shadows.card },
  metricHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  metricIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  metricHeaderCopy: { flex: 1, gap: 2 },
  metricLabel: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: "800" },
  metricDescriptor: { color: colors.textSoft, fontSize: typography.caption, lineHeight: 18 },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  metricValueBlock: { flex: 1, gap: spacing.xs },
  metricValueText: { color: colors.text, fontSize: 40, lineHeight: 44, fontWeight: "800", letterSpacing: -0.5 },
  metricUnitText: { color: colors.textSoft, fontSize: typography.caption, fontWeight: "600" },
  metricStatusText: { color: colors.textMuted, fontSize: typography.label, lineHeight: 20, fontWeight: "600" },
  metricHelperText: { color: colors.textSoft, fontSize: typography.caption, lineHeight: 18 },
  ringWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringPercentText: { color: colors.primary, fontSize: typography.caption, fontWeight: "800" },
  glucoseTrendCard: { width: "100%", borderRadius: 24, borderWidth: borders.standard, borderColor: "#D9E6E7", backgroundColor: "#F4FAFA", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, ...shadows.card },
  glucoseTrendHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  glucoseTrendTitleBlock: { gap: spacing.xxs },
  glucoseTrendTitle: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "900" },
  glucoseTrendSubtitle: { color: colors.textMuted, fontSize: 17, fontWeight: "600" },
  glucoseTrendUnit: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: "700", marginTop: spacing.md },
  glucoseChartBlock: { gap: spacing.xs },
  glucoseChartFrame: { position: "relative", borderRadius: radii.md, backgroundColor: "transparent", overflow: "hidden" },
  glucoseSvg: { width: "100%" },
  glucoseYAxis: { position: "absolute", top: 12, right: spacing.xs, bottom: 24, width: 24, justifyContent: "space-between", alignItems: "flex-end" },
  glucoseYAxisLabel: { color: colors.text, fontSize: 15, fontWeight: "500" },
  glucoseAxisLabels: { position: "relative", height: 20 },
  glucoseAxisLabel: { position: "absolute", top: 0, width: 56, color: colors.text, fontSize: 14, fontWeight: "600" },
  glucoseAxisLabelStart: { marginLeft: 0, textAlign: "left" },
  glucoseAxisLabelCenter: { marginLeft: -28, textAlign: "center" },
  glucoseAxisLabelEnd: { marginLeft: -56, textAlign: "right" },
  glucoseTrendFooter: { color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: "600" },
  syncHeader: { gap: spacing.sm },
  syncBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: 6 },
  syncBadgeText: { color: colors.primary, fontSize: typography.caption, fontWeight: "700" },
  syncTitle: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: "800" },
  syncDescription: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 }
});
