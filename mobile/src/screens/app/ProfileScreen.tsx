import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MonoValue, OutlineButton, Panel, SectionHeader } from "../../components/clinical";
import { api } from "../../lib/api";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
import { average, formatDisplayDate, formatTime } from "../../lib/utils";
import { borders, colors, layout, radii, spacing, typography } from "../../theme/tokens";
import type { AuthSession, ChatThread, DashboardSnapshot, HealthProfile } from "../../types";

type ProfileScreenProps = {
  healthProfile: HealthProfile | null;
  onEditHealthProfile: () => void;
  onLogout: () => Promise<void>;
  onRequestSignIn: () => void;
  session: AuthSession | null;
};

export function ProfileScreen({
  healthProfile,
  onEditHealthProfile,
  onLogout,
  onRequestSignIn,
  session
}: ProfileScreenProps) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [loading, setLoading] = useState(true);
  const { bottomInset, onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle } = useImmersiveTabBarScroll();

  useEffect(() => {
    void loadOverview();
  }, [healthProfile?.updatedAt, session?.userId]);

  async function loadOverview() {
    setLoading(true);

    try {
      const [nextSnapshot, nextThread] = await Promise.all([api.getDashboardSnapshot(), api.getChatThread()]);
      setSnapshot(nextSnapshot);
      setThread(nextThread);
    } finally {
      setLoading(false);
    }
  }

  const userMessageCount = thread?.messages.filter((item) => item.role === "user").length ?? 0;
  const dataSource = snapshot?.dataSource ?? thread?.dataSource ?? "mock";

  const stats = useMemo(() => {
    if (!snapshot) {
      return [
        { label: "7 日平均热量", value: "--", unit: "kcal" },
        { label: "7 日平均运动", value: "--", unit: "min" },
        { label: "7 日平均血糖", value: "--", unit: "mmol/L" },
        { label: "已归档对话", value: "--", unit: "条" }
      ];
    }

    const history = snapshot.history;

    return [
      {
        label: "7 日平均热量",
        value: `${Math.round(average(history.map((item) => item.calories)))}`,
        unit: "kcal"
      },
      {
        label: "7 日平均运动",
        value: `${Math.round(average(history.map((item) => item.exerciseMinutes)))}`,
        unit: "min"
      },
      {
        label: "7 日平均血糖",
        value: `${average(history.map((item) => item.glucoseMmol)).toFixed(1)}`,
        unit: "mmol/L"
      },
      {
        label: "已归档对话",
        value: `${userMessageCount}`,
        unit: "条"
      }
    ];
  }, [snapshot, userMessageCount]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: layout.pageBottom + bottomInset }]}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={scrollEventThrottle}
        showsVerticalScrollIndicator={false}
      >
        <Panel style={styles.heroCard}>
          <SectionHeader
            eyebrow={healthProfile ? `更新于 ${formatDisplayDate(healthProfile.updatedAt.slice(0, 10))}` : "个人主页"}
            title="健康档案与历史概览"
            description="这里负责展示基线信息、统计摘要和设置，不再承载任何日常打卡入口。"
            trailing={<OutlineButton compact label="编辑档案" onPress={onEditHealthProfile} variant="ghost" />}
          />
          <View style={[styles.statusBadge, dataSource === "server" ? styles.statusBadgeServer : styles.statusBadgeMock]}>
            <Text style={[styles.statusBadgeText, dataSource === "server" ? styles.statusBadgeTextServer : styles.statusBadgeTextMock]}>
              {dataSource === "server" ? "后端同步中" : "当前使用离线演示数据"}
            </Text>
          </View>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow={session ? "已登录账户" : "访客模式"}
            title={healthProfile?.nickname || session?.nickname || "健康用户"}
            description={healthProfile?.conditionLabel || "尚未补充疾病标签"}
          />
          <Text style={styles.accountLine}>{healthProfile?.email || session?.email || "本地访客模式"}</Text>
          <Text style={styles.accountHint}>
            {session
              ? "账户已登录，健康记录和主页摘要可以继续同步到多设备。"
              : "未登录也能完成建档与对话归档；只有在需要跨设备同步时才需要登录。"}
          </Text>
          <View style={styles.actionRow}>
            {session ? (
              <OutlineButton label="退出登录" onPress={() => void onLogout()} variant="secondary" />
            ) : (
              <OutlineButton label="登录同步" onPress={onRequestSignIn} variant="primary" />
            )}
          </View>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="健康档案"
            title="基线信息"
            description="这些字段只来自建档向导，后续的每天变化会自动归档到健康记录中。"
          />
          <View style={styles.profileGrid}>
            <View style={styles.profileCell}>
              <Text style={styles.profileLabel}>疾病标签</Text>
              <Text style={styles.profileValue}>{healthProfile?.conditionLabel || "--"}</Text>
            </View>
            <View style={styles.profileCell}>
              <Text style={styles.profileLabel}>阶段目标</Text>
              <Text style={styles.profileValue}>{healthProfile?.primaryTarget || "--"}</Text>
            </View>
            <View style={styles.profileCell}>
              <Text style={styles.profileLabel}>空腹血糖基线</Text>
              <Text style={styles.profileValue}>{healthProfile?.fastingGlucoseBaseline || "--"}</Text>
            </View>
            <View style={styles.profileCell}>
              <Text style={styles.profileLabel}>血压基线</Text>
              <Text style={styles.profileValue}>{healthProfile?.bloodPressureBaseline || "--"}</Text>
            </View>
            <View style={styles.profileCell}>
              <Text style={styles.profileLabel}>当前用药</Text>
              <Text style={styles.profileValue}>{healthProfile?.medicationPlan || "--"}</Text>
            </View>
            <View style={styles.profileCell}>
              <Text style={styles.profileLabel}>照护重点</Text>
              <Text style={styles.profileValue}>{healthProfile?.careFocus || "--"}</Text>
            </View>
          </View>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="历史统计"
            title="最近 7 日概览"
            description={loading ? "正在同步 AI 对话和监测摘要..." : "基于最近 7 日归档结果自动计算。"}
          />
          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <MonoValue value={item.value} unit={item.unit} />
              </View>
            ))}
          </View>
          <Text style={styles.footnote}>
            当前已归档 {userMessageCount} 条用户消息，最近一次方案刷新时间为 {snapshot ? formatTime(snapshot.refreshedAt) : "--:--"}。
          </Text>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="设置"
            title="当前交互规则"
            description="保留必要配置入口，避免重新长出表单中心。"
          />
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>当前数据源</Text>
            <Text style={styles.settingValue}>{dataSource === "server" ? "后端实时接口" : "本地 mock / 离线模式"}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>档案向导</Text>
            <Text style={styles.settingValue}>保留，可随时重进编辑基线</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>语音输入</Text>
            <Text style={styles.settingValue}>已预留前端按钮和 API 占位</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>日常打卡表单</Text>
            <Text style={styles.settingValue}>已移除，统一改为自然语言记录</Text>
          </View>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
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
    backgroundColor: colors.surfaceTint
  },
  accountLine: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  accountHint: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  profileCell: {
    flex: 1,
    minWidth: 150,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs
  },
  profileLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  profileValue: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  statCard: {
    flex: 1,
    minWidth: 145,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs
  },
  statLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  footnote: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: borders.standard,
    borderBottomColor: colors.divider,
    paddingVertical: spacing.sm
  },
  settingLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700"
  },
  settingValue: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: "right"
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  statusBadgeServer: {
    backgroundColor: colors.successSoft
  },
  statusBadgeMock: {
    backgroundColor: colors.warningSoft
  },
  statusBadgeText: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  statusBadgeTextServer: {
    color: colors.success
  },
  statusBadgeTextMock: {
    color: colors.warning
  }
});
