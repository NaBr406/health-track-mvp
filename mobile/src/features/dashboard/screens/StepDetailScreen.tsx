import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MonoValue, Panel, SectionHeader } from "../../../components/clinical";
import { formatDisplayDate, formatShortDate, getTodayString, parseLeadingNumber } from "../../../lib/utils";
import type { DashboardStackParamList } from "../../../navigation/MainTabsNavigator";
import { borders, colors, layout, radii, spacing, typography } from "../../../theme/tokens";
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

type StepDetailDay = {
  date: string;
  totalSteps: number;
  sourceLabel: string;
  walkingKcal: number;
  hourlyBuckets: StepHourBucket[];
};

export function StepDetailScreen({ healthProfile, navigation, route, session }: StepDetailScreenProps) {
  const { snapshot } = route.params;
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<StepDetailDay> | null>(null);
  const initialIndexRef = useRef(
    Math.max(0, buildInitialStepDays(snapshot, healthProfile).findIndex((day) => day.date === snapshot.focusDate))
  );
  const [days, setDays] = useState<StepDetailDay[]>(() => buildInitialStepDays(snapshot, healthProfile));
  const [activeDate, setActiveDate] = useState(snapshot.focusDate);

  const pageWidth = windowWidth;
  const activeIndex = Math.max(
    0,
    days.findIndex((day) => day.date === activeDate)
  );
  const activeDay = days[activeIndex] ?? days[days.length - 1] ?? null;

  useEffect(() => {
    const nextDays = buildInitialStepDays(snapshot, healthProfile);
    setDays(nextDays);
    setActiveDate(snapshot.focusDate);
  }, [healthProfile?.heightCm, healthProfile?.weightKg, snapshot]);

  useEffect(() => {
    let cancelled = false;

    async function loadStepDetailDays() {
      const localRecords = await getMergedLocalStepRecords(session, snapshot.focusDate).catch(() => [] as StepSyncRecord[]);
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
    if (days.length === 0) {
      return;
    }

    const nextIndex = Math.max(
      0,
      days.findIndex((day) => day.date === activeDate)
    );
    listRef.current?.scrollToIndex({ animated: false, index: nextIndex });
  }, [activeDate, days]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.headerShell}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}>
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>步数详情</Text>
          <View style={styles.headerSpacer} />
        </View>

        {activeDay ? (
          <View style={styles.heroBlock}>
            <Text style={styles.heroEyebrow}>{formatDisplayDate(activeDay.date)}</Text>
            <Text style={styles.heroTitle}>{activeDay.date === getTodayString() ? "今日步数分布" : "近几日步数回看"}</Text>
            <Text style={styles.heroDescription}>左右滑动查看近几日步数、全天时段分布和步行消耗估算。</Text>
            <View style={styles.pageIndicatorRow}>
              {days.map((day) => (
                <View
                  key={day.date}
                  style={[styles.pageIndicatorDot, day.date === activeDay.date ? styles.pageIndicatorDotActive : null]}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={days}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
        horizontal
        initialScrollIndex={initialIndexRef.current}
        keyExtractor={(item) => item.date}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(pageWidth, 1));
          setActiveDate(days[Math.min(Math.max(nextIndex, 0), Math.max(days.length - 1, 0))]?.date ?? snapshot.focusDate);
        }}
        pagingEnabled
        renderItem={({ item }) => <StepDetailPage day={item} healthProfile={healthProfile} pageWidth={pageWidth} />}
        showsHorizontalScrollIndicator={false}
        style={styles.pageList}
      />
    </SafeAreaView>
  );
}

function StepDetailPage({
  day,
  healthProfile,
  pageWidth
}: {
  day: StepDetailDay;
  healthProfile: HealthProfile | null;
  pageWidth: number;
}) {
  const peakHour = getPeakHour(day.hourlyBuckets);
  const activeHours = day.hourlyBuckets.filter((bucket) => bucket.steps > 0).length;

  return (
    <ScrollView
      contentContainerStyle={[styles.pageContent, { width: pageWidth, paddingBottom: layout.pageBottom + spacing.xxl }]}
      showsVerticalScrollIndicator={false}
      style={{ width: pageWidth }}
    >
      <Panel>
        <SectionHeader
          eyebrow={day.date === getTodayString() ? "今天" : formatShortDate(day.date)}
          title={formatDisplayDate(day.date)}
          description={`来源：${day.sourceLabel}`}
        />
        <View style={styles.summaryGrid}>
          <SummaryCard label="总步数" value={`${day.totalSteps}`} unit="步" helper="当天累计" />
          <SummaryCard label="步行消耗" value={`${day.walkingKcal}`} unit="kcal" helper="按步数估算" />
          <SummaryCard label="活跃小时" value={day.hourlyBuckets.length > 0 ? `${activeHours}` : "--"} unit={day.hourlyBuckets.length > 0 ? "h" : undefined} helper="有步数记录的小时" />
          <SummaryCard
            label="最高时段"
            value={peakHour ? peakHour.label : "--"}
            unit={peakHour ? `· ${peakHour.steps} 步` : undefined}
            helper="单小时峰值"
          />
        </View>
        <Text style={styles.summaryNote}>{buildWalkingEstimateNote(day.totalSteps, healthProfile)}</Text>
      </Panel>

      <Panel>
        <SectionHeader eyebrow="全天时段步数" title="24 小时分布" description="查看这一天从 00:00 到 23:00 的逐小时步数。" />
        <StepDayBarChart buckets={day.hourlyBuckets} />
      </Panel>
    </ScrollView>
  );
}

function SummaryCard({ helper, label, unit, value }: { label: string; value: string; unit?: string; helper: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <MonoValue unit={unit} value={value} />
      <Text style={styles.summaryHelper}>{helper}</Text>
    </View>
  );
}

function StepDayBarChart({ buckets }: { buckets: StepHourBucket[] }) {
  if (buckets.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <View style={styles.dayChartRow}>
          {Array.from({ length: 24 }, (_, index) => (
            <View key={`ghost-${index}`} style={styles.dayChartColumn}>
              <View style={styles.dayChartTrack}>
                <View
                  style={[
                    styles.dayChartGhostFill,
                    { height: `${18 + ((index % 6) + 1) * 8}%` }
                  ]}
                />
              </View>
              <Text style={styles.dayChartGhostLabel}>{index % 4 === 0 ? `${index}`.padStart(2, "0") : ""}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.emptyChartTitle}>当前暂无小时级步数快照</Text>
        <Text style={styles.emptyChartDescription}>连接设备并等待一段时间采样后，这里会展示当天各时段的步数分布。</Text>
      </View>
    );
  }

  const maxSteps = Math.max(1, ...buckets.map((bucket) => bucket.steps));
  const hasCurrentHour = buckets.some((bucket) => bucket.isCurrentHour);

  return (
    <View style={styles.dayChartBlock}>
      <View style={styles.dayChartRow}>
        {buckets.map((bucket, index) => {
          const height = bucket.steps > 0 ? Math.max((bucket.steps / maxSteps) * 100, 6) : 0;
          const showLabel = index % 4 === 0 || bucket.isCurrentHour;

          return (
            <View key={bucket.hourStartIso} style={styles.dayChartColumn}>
              <View style={styles.dayChartTrack}>
                <View
                  style={[
                    styles.dayChartFill,
                    bucket.isCurrentHour ? styles.dayChartFillCurrent : styles.dayChartFillPast,
                    { height: `${height}%` }
                  ]}
                />
              </View>
              <Text style={[styles.dayChartLabel, bucket.isCurrentHour ? styles.dayChartLabelCurrent : null]}>{showLabel ? bucket.label : ""}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.dayChartLegendRow}>
        <LegendChip color="rgba(0, 82, 204, 0.40)" label="普通时段" />
        {hasCurrentHour ? <LegendChip color={colors.primary} label="当前小时" /> : null}
      </View>
    </View>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendChip}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function buildInitialStepDays(snapshot: DashboardSnapshot, healthProfile: HealthProfile | null): StepDetailDay[] {
  const historyDays = snapshot.history.map((point) => ({
    date: point.date,
    totalSteps: Math.max(0, Math.round(point.steps)),
    sourceLabel: point.date === snapshot.focusDate
      ? snapshot.metrics.find((metric) => metric.id === "steps")?.source ?? point.stepsSource ?? "步数归档"
      : point.stepsSource ?? "步数归档",
    walkingKcal: estimateWalkingKcal(point.steps, healthProfile),
    hourlyBuckets: [] as StepHourBucket[]
  }));
  const focusMetricSteps = parseLeadingNumber(snapshot.metrics.find((metric) => metric.id === "steps")?.value) ?? 0;

  if (!historyDays.some((day) => day.date === snapshot.focusDate)) {
    historyDays.push({
      date: snapshot.focusDate,
      totalSteps: focusMetricSteps,
      sourceLabel: snapshot.metrics.find((metric) => metric.id === "steps")?.source ?? "步数归档",
      walkingKcal: estimateWalkingKcal(focusMetricSteps, healthProfile),
      hourlyBuckets: []
    });
  }

  return historyDays
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => ({
      ...day,
      walkingKcal: estimateWalkingKcal(day.totalSteps, healthProfile)
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
      hourlyBuckets: hourlyByDate.get(date) ?? current?.hourlyBuckets ?? []
    };
  });
}

function getPeakHour(buckets: StepHourBucket[]) {
  const peak = buckets.reduce<StepHourBucket | null>((best, bucket) => {
    if (!best || bucket.steps > best.steps) {
      return bucket;
    }
    return best;
  }, null);

  return peak && peak.steps > 0 ? peak : null;
}

function estimateWalkingKcal(steps: number, healthProfile: HealthProfile | null) {
  const safeSteps = Math.max(0, Math.round(steps));
  if (safeSteps <= 0) {
    return 0;
  }

  const weightKg = healthProfile?.weightKg && healthProfile.weightKg > 25 ? healthProfile.weightKg : 65;
  const strideMeters = healthProfile?.heightCm && healthProfile.heightCm > 100 ? healthProfile.heightCm * 0.415 / 100 : 0.7;
  const distanceKm = safeSteps * strideMeters / 1000;
  return Math.max(0, Math.round(distanceKm * weightKg * 0.53));
}

function buildWalkingEstimateNote(steps: number, healthProfile: HealthProfile | null) {
  const weightKg = healthProfile?.weightKg && healthProfile.weightKg > 25 ? Math.round(healthProfile.weightKg) : 65;
  const strideMeters = healthProfile?.heightCm && healthProfile.heightCm > 100 ? healthProfile.heightCm * 0.415 / 100 : 0.7;
  const distanceKm = Math.max(0, steps) * strideMeters / 1000;
  return `按当前档案估算，约步行 ${distanceKm.toFixed(1)} km，消耗基于 ${weightKg} kg 体重和步幅换算，仅作趋势参考。`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  headerShell: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: layout.pageTop,
    gap: spacing.lg
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  backButtonPressed: {
    opacity: 0.9
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  headerSpacer: {
    width: 44
  },
  heroBlock: {
    gap: spacing.xs
  },
  heroEyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.titleSmall,
    fontWeight: "800"
  },
  heroDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  pageIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.xs
  },
  pageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 82, 204, 0.16)"
  },
  pageIndicatorDotActive: {
    width: 22,
    backgroundColor: colors.primary
  },
  pageContent: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: spacing.lg,
    gap: spacing.lg
  },
  pageList: {
    flex: 1
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryCard: {
    width: "48%",
    minWidth: 148,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  summaryLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  summaryHelper: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20
  },
  summaryNote: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 22
  },
  dayChartBlock: {
    gap: spacing.md
  },
  dayChartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
    minHeight: 176
  },
  dayChartColumn: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs
  },
  dayChartTrack: {
    width: "100%",
    maxWidth: 11,
    height: 136,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 82, 204, 0.10)",
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  dayChartFill: {
    width: "100%",
    borderRadius: radii.pill
  },
  dayChartFillPast: {
    backgroundColor: "rgba(0, 82, 204, 0.38)"
  },
  dayChartFillCurrent: {
    backgroundColor: colors.primary
  },
  dayChartGhostFill: {
    width: "100%",
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 82, 204, 0.12)"
  },
  dayChartLabel: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: "700"
  },
  dayChartLabelCurrent: {
    color: colors.primary
  },
  dayChartGhostLabel: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: "700"
  },
  dayChartLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  legendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 82, 204, 0.05)"
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill
  },
  legendText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  emptyChart: {
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: "rgba(0, 82, 204, 0.03)",
    padding: spacing.md
  },
  emptyChartTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  emptyChartDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  }
});
