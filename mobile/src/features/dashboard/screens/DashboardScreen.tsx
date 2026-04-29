/**
 * 今日仪表盘页面。
 *
 * 页面职责分成三层：
 * 1. 拉取“今日快照”并处理刷新、游客态提示等页面状态。
 * 2. 把原始快照转换成更适合 UI 渲染的卡片元数据。
 * 3. 用一套自绘血糖图表，把历史值和 8 小时预测统一展示出来。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { dashboardApi } from "../api/dashboardApi";
import { DashboardAdviceCard } from "../components/DashboardAdviceCard";
import { DashboardGuestPanel } from "../components/DashboardGuestPanel";
import { DashboardMetricCard } from "../components/DashboardMetricCard";
import {
  applyLiveStepRecord,
  buildAdviceCard,
  buildMetricCards
} from "../model/dashboardScreenModel";
import { deviceStepCounterApi } from "../../steps/api/deviceStepCounterApi";
import { isAuthExpiredError } from "../../../shared/api/client";
import { subscribeDeviceStepCounterLiveUpdates } from "../../../lib/deviceStepCounter";
import { getTodayString } from "../../../lib/utils";
import { useImmersiveTabBarScroll } from "../../../navigation/ImmersiveTabBarContext";
import { colors, layout, spacing, typography } from "../../../theme/tokens";
import type { AuthSession, DashboardSnapshot, HealthProfile, StepSyncRecord } from "../../../types";

type DashboardScreenProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  refreshToken: number;
  onOpenAdjustmentDetail: (snapshot: DashboardSnapshot) => void;
  onOpenStepDetail: (snapshot: DashboardSnapshot) => void;
  onRequestSignIn: () => void;
};

const LIVE_STEP_SYNC_DEBOUNCE_MS = 15_000;

export function DashboardScreen({
  session,
  healthProfile,
  refreshToken,
  onOpenAdjustmentDetail,
  onOpenStepDetail,
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
        <DashboardAdviceCard
          adviceCard={adviceCard}
          disabled={!snapshot}
          onPress={() => snapshot && onOpenAdjustmentDetail(snapshot)}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>今日概览</Text>
          <Text style={styles.sectionTitle}>关键指标</Text>
        </View>

        <View style={styles.metricGrid}>
          {metricCards.map((metric) => (
            <DashboardMetricCard
              key={metric.id}
              metric={metric}
              onPress={metric.id === "steps" && snapshot ? () => onOpenStepDetail(snapshot) : undefined}
            />
          ))}
        </View>

        {!session ? <DashboardGuestPanel onRequestSignIn={onRequestSignIn} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.pageHorizontal, paddingTop: layout.pageTop, paddingBottom: layout.pageBottom, gap: spacing.lg },
  sectionHeader: { gap: spacing.xxs },
  sectionEyebrow: { color: colors.textSoft, fontSize: typography.caption, fontWeight: "700", letterSpacing: 0.3 },
  sectionTitle: { color: colors.text, fontSize: typography.titleSmall, lineHeight: 30, fontWeight: "800" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: spacing.sm }
});

