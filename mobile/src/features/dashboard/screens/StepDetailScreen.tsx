import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { parseLeadingNumber } from "../../../lib/utils";
import type { DashboardStackParamList } from "../../../navigation/MainTabsNavigator";
import { borders, colors, layout, radii, shadows, spacing, typography } from "../../../theme/tokens";
import type { AuthSession, DashboardSnapshot, HealthProfile, StepHourBucket, StepSyncRecord } from "../../../types";
import {
  getHourlyStepTrendForDate,
  getMergedLocalStepRecords,
  resolveDisplayStepSource
} from "../../steps/api/deviceStepCounterApi";

type StepDetailScreenProps = NativeStackScreenProps<DashboardStackParamList, "StepDetail"> & {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
};

type StepDetailMode = "day" | "week" | "month";

type StepDetailDay = {
  date: string;
  totalSteps: number;
  sourceLabel: string;
  walkingKcal: number;
  distanceKm: number;
  hourlyBuckets: StepHourBucket[];
};

type SummaryBarPoint = {
  key: string;
  label: string;
  value: number;
  selected: boolean;
};

type PeriodOverview = {
  totalSteps: number;
  distanceKm: number;
  walkingKcal: number;
  helperText: string;
  periodLabel: string;
  overviewTitle: string;
  averageSteps: number;
  averageDistanceKm: number;
};

const MODE_LABELS: Array<{ key: StepDetailMode; label: string }> = [
  { key: "day", label: "日" },
  { key: "week", label: "周" },
  { key: "month", label: "月" }
];

const CHART_Y_TICKS = [0, 400, 800, 1200, 1600, 2000];
const DAY_CHART_HEIGHT = 220;
const SUMMARY_CHART_HEIGHT = 200;

export function StepDetailScreen({ healthProfile, navigation, route, session }: StepDetailScreenProps) {
  const { snapshot } = route.params;
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<StepDetailDay> | null>(null);
  const dayListSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingDayListRef = useRef(false);
  const initialDays = buildInitialStepDays(snapshot, healthProfile);
  const initialIndex = Math.max(0, initialDays.findIndex((day) => day.date === snapshot.focusDate));
  const [days, setDays] = useState<StepDetailDay[]>(initialDays);
  const [activeDate, setActiveDate] = useState(snapshot.focusDate);
  const [mode, setMode] = useState<StepDetailMode>("day");
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const pageWidth = windowWidth;
  const activeIndex = Math.max(0, days.findIndex((day) => day.date === activeDate));
  const activeDay = days[activeIndex] ?? days[days.length - 1] ?? null;

  useEffect(() => {
    const nextDays = buildInitialStepDays(snapshot, healthProfile);
    setDays(nextDays);
    setActiveDate(snapshot.focusDate);
    setMode("day");
  }, [healthProfile?.heightCm, healthProfile?.weightKg, snapshot]);

  useEffect(() => {
    let cancelled = false;

    async function loadStepDetailDays() {
      const localRecords = await getMergedLocalStepRecords(session, snapshot.focusDate, 31).catch(() => [] as StepSyncRecord[]);
      const dates = buildDateWindow(snapshot, localRecords);
      const hourlyEntries = await Promise.all(
        dates.map(async (date) => [date, await getHourlyStepTrendForDate(session, date).catch(() => [] as StepHourBucket[])] as const)
      );

      if (cancelled) {
        return;
      }

      const hourlyByDate = new Map(hourlyEntries);
      setDays((current) => mergeStepDetailDays(current, dates, localRecords, hourlyByDate, snapshot, healthProfile));
    }

    void loadStepDetailDays();

    return () => {
      cancelled = true;
    };
  }, [healthProfile?.heightCm, healthProfile?.weightKg, session, snapshot]);

  useEffect(() => {
    if (mode !== "day" || days.length === 0) {
      return;
    }

    const nextIndex = Math.max(0, days.findIndex((day) => day.date === activeDate));
    isSyncingDayListRef.current = true;
    listRef.current?.scrollToIndex({ animated: false, index: nextIndex });

    if (dayListSyncTimerRef.current) {
      clearTimeout(dayListSyncTimerRef.current);
    }

    dayListSyncTimerRef.current = setTimeout(() => {
      isSyncingDayListRef.current = false;
      dayListSyncTimerRef.current = null;
    }, 120);
  }, [activeDate, days, mode]);

  useEffect(
    () => () => {
      if (dayListSyncTimerRef.current) {
        clearTimeout(dayListSyncTimerRef.current);
        dayListSyncTimerRef.current = null;
      }
    },
    []
  );

  const dateOptions = useMemo(
    () =>
      [...days]
        .sort((left, right) => right.date.localeCompare(left.date))
        .map((day) => ({
          date: day.date,
          title: formatHeaderDate(day.date),
          subtitle: `${day.totalSteps} 步`
        })),
    [days]
  );

  const headerDateLabel = useMemo(() => buildHeaderDateLabel(activeDate, mode), [activeDate, mode]);
  const chartData = useMemo(() => buildSummaryChartData(days, activeDate, mode), [days, activeDate, mode]);
  const overviewValues = useMemo(() => buildOverviewValues(days, activeDate, mode), [days, activeDate, mode]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.headerShell}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={({ pressed }) => [styles.iconButton, pressed ? styles.iconButtonPressed : null]}>
            <Ionicons color={colors.text} name="arrow-back" size={22} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>步数</Text>
            <Pressable
              accessibilityRole="button"
            onPress={() => setDatePickerVisible(true)}
            style={({ pressed }) => [styles.headerDateButton, pressed ? styles.headerDateButtonPressed : null]}
          >
              <Text style={styles.headerDate}>{headerDateLabel}</Text>
              <Ionicons color={colors.textSoft} name="chevron-down" size={16} />
            </Pressable>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>

        <View style={styles.segmentedControl}>
          {MODE_LABELS.map((item) => {
            const selected = mode === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => setMode(item.key)}
                style={({ pressed }) => [
                  styles.segmentItem,
                  selected ? styles.segmentItemActive : null,
                  pressed ? styles.segmentItemPressed : null
                ]}
              >
                <Text style={[styles.segmentLabel, selected ? styles.segmentLabelActive : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mode === "day" ? (
        <FlatList
          ref={listRef}
          data={days}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
          horizontal
          initialScrollIndex={initialIndex}
          keyExtractor={(item) => item.date}
          onMomentumScrollEnd={(event) => {
            if (isSyncingDayListRef.current) {
              return;
            }

            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(pageWidth, 1));
            setActiveDate(days[Math.min(Math.max(nextIndex, 0), Math.max(days.length - 1, 0))]?.date ?? snapshot.focusDate);
          }}
          pagingEnabled
          renderItem={({ item }) => <StepDayPage day={item} pageWidth={pageWidth} />}
          showsHorizontalScrollIndicator={false}
          style={styles.pageList}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.summaryPageContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroMetricsBlock}>
            <View style={styles.heroStepLine}>
              <Text style={styles.heroStepValue}>{`${overviewValues.totalSteps}`}</Text>
              <Text style={styles.heroStepUnit}>步</Text>
            </View>
            <Text style={styles.heroMetricDate}>{overviewValues.periodLabel}</Text>
            <Text style={styles.heroSourceText}>{overviewValues.helperText}</Text>
          </View>

          <View style={styles.chartCard}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>{mode === "week" ? "近 7 天" : "近 31 天"}</Text>
                <Text style={styles.sectionTitle}>{mode === "week" ? "每日步数趋势" : "月度步数趋势"}</Text>
              </View>
              <Text style={styles.sectionHint}>点击日期可切换锚点</Text>
            </View>
            <StepSummaryBarChart points={chartData} mode={mode} />
          </View>

          <OverviewCard
            averageDistanceKm={overviewValues.averageDistanceKm}
            averageSteps={overviewValues.averageSteps}
            helperText={overviewValues.helperText}
            walkingKcal={overviewValues.walkingKcal}
            distanceKm={overviewValues.distanceKm}
            totalSteps={overviewValues.totalSteps}
            title={overviewValues.overviewTitle}
            showAverages
          />
        </ScrollView>
      )}

      <DatePickerSheet
        activeDate={activeDate}
        onClose={() => setDatePickerVisible(false)}
        onSelect={(date) => {
          setActiveDate(date);
          setDatePickerVisible(false);
        }}
        options={dateOptions}
        visible={datePickerVisible}
      />
    </SafeAreaView>
  );
}

function StepDayPage({
  day,
  pageWidth
}: {
  day: StepDetailDay;
  pageWidth: number;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.pageContent, { width: pageWidth }]}
      showsVerticalScrollIndicator={false}
      style={{ width: pageWidth }}
    >
      <View style={styles.heroMetricsBlock}>
        <View style={styles.heroStepLine}>
          <Text style={styles.heroStepValue}>{`${day.totalSteps}`}</Text>
          <Text style={styles.heroStepUnit}>步</Text>
        </View>
        <Text style={styles.heroMetricDate}>{formatHeaderDate(day.date)}</Text>
        <Text style={styles.heroSourceText}>{day.sourceLabel}</Text>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionEyebrow}>全天步数</Text>
            <Text style={styles.sectionTitle}>24 小时时段分布</Text>
          </View>
          <Text style={styles.sectionHint}>左右滑动切换日期</Text>
        </View>
        <StepDayBarChart buckets={day.hourlyBuckets} />
      </View>

      <OverviewCard
        helperText={day.sourceLabel}
        walkingKcal={day.walkingKcal}
        distanceKm={day.distanceKm}
        totalSteps={day.totalSteps}
      />
    </ScrollView>
  );
}

function OverviewCard({
  averageDistanceKm,
  averageSteps,
  helperText,
  walkingKcal,
  distanceKm,
  totalSteps,
  title,
  showAverages = false
}: {
  totalSteps: number;
  distanceKm: number;
  walkingKcal: number;
  helperText: string;
  averageSteps?: number;
  averageDistanceKm?: number;
  title?: string;
  showAverages?: boolean;
}) {
  return (
    <View style={styles.overviewCard}>
      <View style={styles.overviewHeader}>
        <View style={styles.overviewIconWrap}>
          <Ionicons color={colors.primary} name="eye-outline" size={18} />
        </View>
        <Text style={styles.overviewTitle}>{title ?? "今日概览"}</Text>
      </View>

      <View style={styles.overviewDivider} />

      <View style={styles.overviewStatsRow}>
        <OverviewStat label={showAverages ? "总步数" : "今日步数"} unit="步" value={`${totalSteps}`} />
        <View style={styles.overviewStatsSeparator} />
        <OverviewStat label={showAverages ? "总距离" : "今日距离"} unit="公里" value={distanceKm.toFixed(2)} />
      </View>

      {showAverages ? (
        <>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewStatsRow}>
            <OverviewStat label="日均步数" unit="步" value={`${averageSteps ?? 0}`} />
            <View style={styles.overviewStatsSeparator} />
            <OverviewStat label="日均距离" unit="公里" value={(averageDistanceKm ?? 0).toFixed(2)} />
          </View>
        </>
      ) : (
        <View style={styles.summaryMetaRow}>
          <MetaPill label="步行消耗" value={`${walkingKcal} kcal`} />
          <MetaPill label="数据来源" value={helperText} />
        </View>
      )}
    </View>
  );
}

function OverviewStat({ label, unit, value }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.overviewStatBlock}>
      <View style={styles.overviewValueLine}>
        <Text style={styles.overviewValue}>{value}</Text>
        <Text style={styles.overviewUnit}>{unit}</Text>
      </View>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metaPillValue}>
        {value}
      </Text>
    </View>
  );
}

function DatePickerSheet({
  activeDate,
  onClose,
  onSelect,
  options,
  visible
}: {
  visible: boolean;
  activeDate: string;
  options: Array<{ date: string; title: string; subtitle: string }>;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <Pressable style={styles.dateSheet} onPress={() => undefined}>
          <View style={styles.dateSheetHeader}>
            <Text style={styles.dateSheetTitle}>选择日期</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.dateSheetCloseButton, pressed ? styles.iconButtonPressed : null]}>
              <Ionicons color={colors.textSoft} name="close" size={18} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.dateSheetScroll}>
            {options.map((option) => {
              const selected = option.date === activeDate;
              return (
                <Pressable
                  key={option.date}
                  accessibilityRole="button"
                  onPress={() => onSelect(option.date)}
                  style={({ pressed }) => [
                    styles.dateOption,
                    selected ? styles.dateOptionActive : null,
                    pressed ? styles.dateOptionPressed : null
                  ]}
                >
                  <View style={styles.dateOptionCopy}>
                    <Text style={[styles.dateOptionTitle, selected ? styles.dateOptionTitleActive : null]}>{option.title}</Text>
                    <Text style={styles.dateOptionSubtitle}>{option.subtitle}</Text>
                  </View>
                  {selected ? <Ionicons color={colors.primary} name="checkmark-circle" size={18} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StepDayBarChart({ buckets }: { buckets: StepHourBucket[] }) {
  const chartBuckets = buckets.length > 0 ? buckets : buildEmptyChartBuckets();
  const { ticks, topValue } = buildDayChartScale(chartBuckets);
  const hasBars = buckets.length > 0;

  return (
    <View>
      <View style={styles.chartShell}>
        <View style={[styles.chartArea, { height: DAY_CHART_HEIGHT }]}>
          {ticks.slice(1).map((tick) => {
            const bottom = DAY_CHART_HEIGHT - (tick / topValue) * DAY_CHART_HEIGHT;
            return <View key={tick} style={[styles.chartGridLine, { bottom }]} />;
          })}

          <View style={styles.chartColumnsRow}>
            {chartBuckets.map((bucket, index) => {
              const height = bucket.steps > 0 ? Math.max((bucket.steps / topValue) * 100, 2.5) : 0;
              return (
                <View key={bucket.hourStartIso || `${bucket.label}-${index}`} style={styles.chartColumn}>
                  {hasBars ? (
                    <View
                      style={[
                        styles.chartBar,
                        bucket.steps <= 0 ? styles.chartBarZero : null,
                        { height: `${height}%` }
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.chartYAxis, { height: DAY_CHART_HEIGHT }]}>
          {ticks.slice().reverse().map((tick) => (
            <Text key={tick} style={styles.yAxisLabel}>
              {tick.toLocaleString("en-US")}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.chartXAxis}>
        {["00:00", "06:00", "12:00", "18:00", "00:00"].map((label) => (
          <Text key={label} style={styles.xAxisLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function StepSummaryBarChart({ points, mode }: { points: SummaryBarPoint[]; mode: StepDetailMode }) {
  const { ticks, topValue } = buildSummaryChartScale(points, mode);
  const isMonthMode = mode === "month";

  return (
    <View>
      <View style={styles.chartShell}>
        <View style={[styles.chartArea, { height: SUMMARY_CHART_HEIGHT }]}>
          {ticks.slice(1).map((tick) => {
            const bottom = SUMMARY_CHART_HEIGHT - (tick / topValue) * SUMMARY_CHART_HEIGHT;
            return <View key={tick} style={[styles.chartGridLine, { bottom }]} />;
          })}

          <View style={[styles.summaryChartRow, isMonthMode ? styles.summaryChartRowMonth : null]}>
            {points.map((point) => {
              const height = point.value > 0 ? Math.max((point.value / topValue) * 100, 4) : 0;
              return (
                <View key={point.key} style={styles.summaryChartColumn}>
                  <View style={[styles.summaryChartTrack, isMonthMode ? styles.summaryChartTrackMonth : null]}>
                    <View
                      style={[
                        styles.summaryChartBar,
                        isMonthMode ? styles.summaryChartBarMonth : null,
                        point.selected ? styles.summaryChartBarSelected : null,
                        { height: `${height}%` }
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.chartYAxis, { height: SUMMARY_CHART_HEIGHT }]}>
          {ticks.slice().reverse().map((tick) => (
            <Text key={tick} style={styles.yAxisLabel}>
              {tick.toLocaleString("en-US")}
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.summaryChartXAxis, isMonthMode ? styles.summaryChartXAxisMonth : null]}>
        {points.map((point) => (
          <View key={`${point.key}-label`} style={styles.summaryChartXAxisSlot}>
            <Text style={[styles.summaryChartLabel, point.selected ? styles.summaryChartLabelSelected : null]}>
              {point.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function buildEmptyChartBuckets(): StepHourBucket[] {
  return Array.from({ length: 24 }, (_, index) => ({
    hourStartIso: `empty-${index}`,
    label: `${index}`.padStart(2, "0"),
    steps: 0,
    isCurrentHour: false
  }));
}

function buildInitialStepDays(snapshot: DashboardSnapshot, healthProfile: HealthProfile | null): StepDetailDay[] {
  const historyDays = snapshot.history.map((point) => {
    const totalSteps = Math.max(0, Math.round(point.steps));
    const distanceKm = estimateWalkingDistanceKm(totalSteps, healthProfile);
    return {
      date: point.date,
      totalSteps,
      sourceLabel: point.date === snapshot.focusDate
        ? snapshot.metrics.find((metric) => metric.id === "steps")?.source ?? point.stepsSource ?? "步数归档"
        : point.stepsSource ?? "步数归档",
      walkingKcal: estimateWalkingKcal(totalSteps, healthProfile),
      distanceKm,
      hourlyBuckets: [] as StepHourBucket[]
    };
  });
  const focusMetricSteps = parseLeadingNumber(snapshot.metrics.find((metric) => metric.id === "steps")?.value) ?? 0;

  if (!historyDays.some((day) => day.date === snapshot.focusDate)) {
    historyDays.push({
      date: snapshot.focusDate,
      totalSteps: focusMetricSteps,
      sourceLabel: snapshot.metrics.find((metric) => metric.id === "steps")?.source ?? "步数归档",
      walkingKcal: estimateWalkingKcal(focusMetricSteps, healthProfile),
      distanceKm: estimateWalkingDistanceKm(focusMetricSteps, healthProfile),
      hourlyBuckets: []
    });
  }

  return historyDays
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => ({
      ...day,
      walkingKcal: estimateWalkingKcal(day.totalSteps, healthProfile),
      distanceKm: estimateWalkingDistanceKm(day.totalSteps, healthProfile)
    }));
}

function buildDateWindow(snapshot: DashboardSnapshot, localRecords: StepSyncRecord[]) {
  const dates = new Set<string>(snapshot.history.map((point) => point.date));
  dates.add(snapshot.focusDate);
  localRecords.forEach((record) => dates.add(record.recordedOn));
  return [...dates].sort((left, right) => left.localeCompare(right));
}

function mergeStepDetailDays(
  currentDays: StepDetailDay[],
  dates: string[],
  localRecords: StepSyncRecord[],
  hourlyByDate: Map<string, StepHourBucket[]>,
  snapshot: DashboardSnapshot,
  healthProfile: HealthProfile | null
) {
  const currentByDate = new Map(currentDays.map((day) => [day.date, day]));
  const localByDate = new Map(localRecords.map((record) => [record.recordedOn, record]));
  const metricSource = snapshot.metrics.find((metric) => metric.id === "steps")?.source ?? "步数归档";

  return dates.map((date) => {
    const current = currentByDate.get(date);
    const local = localByDate.get(date);
    const totalSteps = local ? Math.max(current?.totalSteps ?? 0, local.steps) : current?.totalSteps ?? 0;
    const sourceLabel = local && local.steps >= (current?.totalSteps ?? 0)
      ? resolveDisplayStepSource(local)
      : current?.sourceLabel ?? (date === snapshot.focusDate ? metricSource : "步数归档");

    return {
      date,
      totalSteps,
      sourceLabel,
      walkingKcal: estimateWalkingKcal(totalSteps, healthProfile),
      distanceKm: estimateWalkingDistanceKm(totalSteps, healthProfile),
      hourlyBuckets: hourlyByDate.get(date) ?? current?.hourlyBuckets ?? []
    };
  });
}

function buildSummaryChartData(days: StepDetailDay[], activeDate: string, mode: StepDetailMode): SummaryBarPoint[] {
  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const rangeDates = mode === "week" ? buildNaturalWeekDates(activeDate) : buildNaturalMonthDates(activeDate);

  return rangeDates.map((date) => {
    const matched = daysByDate.get(date);
    const dayOfMonth = Number(date.slice(8, 10));
    const label = mode === "week"
      ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
      : [1, 7, 14, 21, 28].includes(dayOfMonth) ? `${dayOfMonth}日` : "";

    return {
      key: date,
      label,
      value: matched?.totalSteps ?? 0,
      selected: date === activeDate
    };
  });
}

function buildOverviewValues(days: StepDetailDay[], activeDate: string, mode: StepDetailMode): PeriodOverview {
  const sorted = [...days].sort((left, right) => left.date.localeCompare(right.date));
  const activeIndex = Math.max(0, sorted.findIndex((day) => day.date === activeDate));
  const fallbackIndex = Math.max(sorted.length - 1, 0);
  const anchorIndex = activeIndex >= 0 ? activeIndex : fallbackIndex;

  if (mode === "day") {
    const day = sorted[anchorIndex] ?? null;
    return {
      totalSteps: day?.totalSteps ?? 0,
      distanceKm: day?.distanceKm ?? 0,
      walkingKcal: day?.walkingKcal ?? 0,
      helperText: day?.sourceLabel ?? "步数归档",
      periodLabel: formatHeaderDate(day?.date ?? activeDate),
      overviewTitle: "今日概览",
      averageSteps: day?.totalSteps ?? 0,
      averageDistanceKm: day?.distanceKm ?? 0
    };
  }

  const daysByDate = new Map(sorted.map((day) => [day.date, day]));
  const rangeDates = mode === "week" ? buildNaturalWeekDates(activeDate) : buildNaturalMonthDates(activeDate);
  const elapsedDates = rangeDates.filter((date) => date <= activeDate);
  const totalSteps = elapsedDates.reduce((sum, date) => sum + (daysByDate.get(date)?.totalSteps ?? 0), 0);
  const distanceKm = elapsedDates.reduce((sum, date) => sum + (daysByDate.get(date)?.distanceKm ?? 0), 0);
  const walkingKcal = elapsedDates.reduce((sum, date) => sum + (daysByDate.get(date)?.walkingKcal ?? 0), 0);
  const effectiveDays = Math.max(elapsedDates.length, 1);
  const periodLabel =
    rangeDates.length > 0
      ? mode === "week"
        ? `${formatHeaderDate(rangeDates[0])}至${formatHeaderDate(rangeDates[rangeDates.length - 1])}`
        : formatMonthLabel(activeDate)
      : "--";

  return {
    totalSteps,
    distanceKm,
    walkingKcal,
    helperText: mode === "week" ? "按本周已记录天数计算日均值" : "按本月已记录天数计算日均值",
    periodLabel,
    overviewTitle: mode === "week" ? "本周概览" : "本月概览",
    averageSteps: Math.round(totalSteps / effectiveDays),
    averageDistanceKm: distanceKm / effectiveDays
  };
}

function buildHeaderDateLabel(activeDate: string, mode: StepDetailMode) {
  if (mode === "day") {
    return formatHeaderDate(activeDate);
  }

  if (mode === "week") {
    const rangeDates = buildNaturalWeekDates(activeDate);
    return `${formatHeaderDate(rangeDates[0])}至${formatHeaderDate(rangeDates[rangeDates.length - 1])}`;
  }

  return formatMonthLabel(activeDate);
}

function buildNaturalWeekDates(activeDate: string) {
  const anchor = new Date(`${activeDate}T00:00:00`);
  const weekday = (anchor.getDay() + 6) % 7;
  anchor.setDate(anchor.getDate() - weekday);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + index);
    return toDateKey(date);
  });
}

function buildNaturalMonthDates(activeDate: string) {
  const anchor = new Date(`${activeDate}T00:00:00`);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return toDateKey(date);
  });
}

function buildSummaryChartScale(points: SummaryBarPoint[], mode: StepDetailMode) {
  const maxValue = Math.max(0, ...points.map((point) => point.value));
  const step = mode === "week" ? 3000 : 4000;
  const minimumTop = mode === "week" ? 15000 : 20000;
  const topValue = Math.max(minimumTop, Math.ceil(maxValue / step) * step);
  const ticks = Array.from({ length: Math.floor(topValue / step) + 1 }, (_, index) => index * step);

  return {
    topValue,
    ticks
  };
}

function buildDayChartScale(buckets: StepHourBucket[]) {
  const maxValue = Math.max(0, ...buckets.map((bucket) => bucket.steps));

  if (maxValue <= 200) {
    return { topValue: 200, ticks: [0, 50, 100, 150, 200] };
  }

  if (maxValue <= 400) {
    return { topValue: 400, ticks: [0, 100, 200, 300, 400] };
  }

  if (maxValue <= 800) {
    return { topValue: 800, ticks: [0, 200, 400, 600, 800] };
  }

  if (maxValue <= 1200) {
    return { topValue: 1200, ticks: [0, 300, 600, 900, 1200] };
  }

  const step = 500;
  const topValue = Math.max(2000, Math.ceil(maxValue / step) * step);
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round((topValue / 4) * index));

  return {
    topValue,
    ticks
  };
}

function estimateWalkingKcal(steps: number, healthProfile: HealthProfile | null) {
  const safeSteps = Math.max(0, Math.round(steps));
  if (safeSteps <= 0) {
    return 0;
  }

  const weightKg = healthProfile?.weightKg && healthProfile.weightKg > 25 ? healthProfile.weightKg : 65;
  const distanceKm = estimateWalkingDistanceKm(safeSteps, healthProfile);
  return Math.max(0, Math.round(distanceKm * weightKg * 0.53));
}

function estimateWalkingDistanceKm(steps: number, healthProfile: HealthProfile | null) {
  const safeSteps = Math.max(0, Math.round(steps));
  if (safeSteps <= 0) {
    return 0;
  }

  const strideMeters = healthProfile?.heightCm && healthProfile.heightCm > 100 ? healthProfile.heightCm * 0.415 / 100 : 0.7;
  return safeSteps * strideMeters / 1000;
}

function formatHeaderDate(date: string) {
  const [year = "", month = "", day = ""] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatMonthLabel(date: string) {
  const [year = "", month = ""] = date.split("-");
  return `${year}年${Number(month)}月`;
}

function formatShortDate(date: string) {
  return date.slice(5).replace("-", "/");
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  headerShell: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: layout.pageTop,
    gap: spacing.md
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card
  },
  iconButtonPressed: {
    opacity: 0.86
  },
  headerCopy: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.md
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.titleSmall,
    fontWeight: "800"
  },
  headerDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.md
  },
  headerDateButtonPressed: {
    backgroundColor: colors.primarySoft
  },
  headerDate: {
    color: colors.textSoft,
    fontSize: typography.body,
    fontWeight: "500"
  },
  headerRightSpacer: {
    width: 44
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 4,
    ...shadows.card
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    paddingVertical: 10
  },
  segmentItemActive: {
    backgroundColor: colors.primarySoft
  },
  segmentItemPressed: {
    opacity: 0.9
  },
  segmentLabel: {
    color: colors.textSoft,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  segmentLabelActive: {
    color: colors.primary
  },
  pageList: {
    flex: 1
  },
  pageContent: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: layout.pageBottom + spacing.md,
    gap: spacing.md
  },
  summaryPageContent: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: layout.pageBottom + spacing.md,
    gap: spacing.md
  },
  heroMetricsBlock: {
    gap: spacing.xxs
  },
  heroStepLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs
  },
  heroStepValue: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -0.8
  },
  heroStepUnit: {
    color: colors.textSoft,
    fontSize: typography.bodyLarge,
    lineHeight: 28,
    fontWeight: "700",
    paddingBottom: 5
  },
  heroMetricDate: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: "500"
  },
  heroSourceText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 18
  },
  chartCard: {
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionEyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800",
    paddingTop: 2
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    paddingTop: 2
  },
  chartShell: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm
  },
  chartArea: {
    flex: 1,
    backgroundColor: colors.backgroundAccent,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    position: "relative",
    overflow: "hidden"
  },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: "rgba(0, 82, 204, 0.08)"
  },
  chartColumnsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  chartColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%"
  },
  chartBar: {
    width: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.primary
  },
  chartBarZero: {
    backgroundColor: "rgba(0, 82, 204, 0.22)"
  },
  chartYAxis: {
    width: 42,
    justifyContent: "space-between",
    paddingVertical: 2
  },
  yAxisLabel: {
    color: colors.textSoft,
    fontSize: 11,
    textAlign: "left"
  },
  chartXAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    paddingHorizontal: 2
  },
  xAxisLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "500"
  },
  summaryChartRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  summaryChartRowMonth: {
    paddingHorizontal: spacing.xs
  },
  summaryChartColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%"
  },
  summaryChartTrack: {
    width: "100%",
    maxWidth: 20,
    height: 144,
    justifyContent: "flex-end",
    alignItems: "center"
  },
  summaryChartTrackMonth: {
    maxWidth: 10
  },
  summaryChartBar: {
    width: 12,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 82, 204, 0.34)"
  },
  summaryChartBarMonth: {
    width: 6,
    borderRadius: 3
  },
  summaryChartBarSelected: {
    backgroundColor: colors.primary
  },
  summaryChartXAxis: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  summaryChartXAxisMonth: {
    paddingHorizontal: spacing.xs
  },
  summaryChartXAxisSlot: {
    flex: 1,
    alignItems: "center"
  },
  summaryChartLabel: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center"
  },
  summaryChartLabelSelected: {
    color: colors.primary
  },
  overviewCard: {
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  overviewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  overviewTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  overviewDivider: {
    height: 1,
    backgroundColor: colors.divider
  },
  overviewStatsRow: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  overviewStatBlock: {
    flex: 1,
    gap: spacing.xxs
  },
  overviewStatsSeparator: {
    width: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md
  },
  overviewValueLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs
  },
  overviewValue: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  overviewUnit: {
    color: colors.textSoft,
    fontSize: typography.label,
    lineHeight: 20,
    fontWeight: "600",
    paddingBottom: 3
  },
  overviewLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: "500"
  },
  summaryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metaPill: {
    borderRadius: radii.md,
    backgroundColor: colors.backgroundAccent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minWidth: "48%",
    gap: 2
  },
  metaPillLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  metaPillValue: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 35, 59, 0.18)",
    justifyContent: "flex-end",
    padding: spacing.lg
  },
  dateSheet: {
    maxHeight: "72%",
    borderRadius: radii.xl,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    ...shadows.lift
  },
  dateSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.sm
  },
  dateSheetTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  dateSheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  dateSheetScroll: {
    maxHeight: 420
  },
  dateOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  dateOptionActive: {
    backgroundColor: colors.primarySoft
  },
  dateOptionPressed: {
    opacity: 0.88
  },
  dateOptionCopy: {
    gap: 2
  },
  dateOptionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700"
  },
  dateOptionTitleActive: {
    color: colors.primary
  },
  dateOptionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption
  }
});
