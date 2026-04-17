import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MonoValue, OutlineButton, Panel, SectionHeader } from "../../components/clinical";
import { ProfileAvatar } from "../../components/ProfileAvatar";
import { api } from "../../lib/api";
import { average, formatDisplayDate, formatTime } from "../../lib/utils";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
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
  const displayName = healthProfile?.nickname || session?.nickname || "健康用户";
  const displayEmail = healthProfile?.email || session?.email || "本地访客模式";
  const displayCondition = healthProfile?.conditionLabel || "尚未补充疾病标签";
  const avatarModeLabel = healthProfile?.avatarUri ? "已使用自定义头像" : "当前使用预设头像";
  const lastUpdatedLabel = healthProfile?.updatedAt
    ? `最近更新 ${formatDisplayDate(healthProfile.updatedAt.slice(0, 10))}`
    : "个人主页";

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
    const recordedGlucose = history.filter((item) => item.glucoseSource === "recorded").map((item) => item.glucoseMmol);

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
        value: recordedGlucose.length > 0 ? `${average(recordedGlucose).toFixed(1)}` : "--",
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
          <View style={styles.heroTopRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onEditHealthProfile}
              style={({ pressed }) => [styles.avatarTrigger, pressed ? styles.avatarTriggerPressed : null]}
            >
              <ProfileAvatar avatarUri={healthProfile?.avatarUri} nickname={displayName} presetId={healthProfile?.avatarPresetId} size={86} />
              <View style={styles.avatarEditBadge}>
                <Ionicons color={colors.inverseText} name="pencil" size={14} />
              </View>
            </Pressable>

            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{lastUpdatedLabel}</Text>
              <Text style={styles.heroName}>{displayName}</Text>
              <Text style={styles.heroCondition}>{displayCondition}</Text>
              <Text style={styles.heroEmail}>{displayEmail}</Text>
            </View>
          </View>

          <View style={styles.avatarHintRow}>
            <View style={styles.avatarModeBadge}>
              <Ionicons color={colors.primary} name={healthProfile?.avatarUri ? "image-outline" : "sparkles-outline"} size={15} />
              <Text style={styles.avatarModeBadgeText}>{avatarModeLabel}</Text>
            </View>
            <Text style={styles.avatarHintText}>点击顶部头像或“编辑资料”，即可更换头像、昵称和基础信息。</Text>
          </View>

          <View style={styles.heroActionRow}>
            <View style={[styles.statusBadge, dataSource === "server" ? styles.statusBadgeServer : styles.statusBadgeMock]}>
              <Text style={[styles.statusBadgeText, dataSource === "server" ? styles.statusBadgeTextServer : styles.statusBadgeTextMock]}>
                {dataSource === "server" ? "已连接云端" : "当前为本地离线模式"}
              </Text>
            </View>
            <OutlineButton label="编辑资料" onPress={onEditHealthProfile} variant="ghost" />
          </View>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="资料概览"
            title="头像、昵称与基础档案"
            description="这里保留为唯一的结构化资料编辑入口。日常记录已经取消表单，继续统一通过 AI 对话完成。"
          />

          <View style={styles.profileGrid}>
            <ProfileCell label="昵称" value={displayName} />
            <ProfileCell label="疾病标签" value={healthProfile?.conditionLabel || "--"} />
            <ProfileCell label="阶段目标" value={healthProfile?.primaryTarget || "--"} />
            <ProfileCell label="空腹血糖基线" value={healthProfile?.fastingGlucoseBaseline || "--"} />
            <ProfileCell label="血压基线" value={healthProfile?.bloodPressureBaseline || "--"} />
            <ProfileCell label="当前用药" value={healthProfile?.medicationPlan || "--"} />
            <ProfileCell label="照护重点" value={healthProfile?.careFocus || "--"} />
            <ProfileCell label="补充备注" value={healthProfile?.notes || "--"} />
          </View>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="历史统计"
            title="最近 7 日概览"
            description={loading ? "正在同步 AI 对话与监测摘要..." : "基于最近 7 日归档结果自动计算。"}
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
            eyebrow="账户与设置"
            title="同步状态与当前规则"
            description="基础档案支持随时修改。饮食、运动、睡眠等动态记录继续只保留 AI 对话入口。"
          />

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>当前数据源</Text>
            <Text style={styles.settingValue}>{dataSource === "server" ? "后端实时接口" : "本地离线模式"}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>头像模式</Text>
            <Text style={styles.settingValue}>{healthProfile?.avatarUri ? "自定义头像" : "预设头像"}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>档案编辑</Text>
            <Text style={styles.settingValue}>支持修改头像、昵称与基础资料</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>日常记录入口</Text>
            <Text style={styles.settingValue}>仅保留 AI 对话页</Text>
          </View>

          <View style={styles.accountActionRow}>
            {session ? (
              <OutlineButton label="退出登录" onPress={() => void onLogout()} variant="secondary" />
            ) : (
              <OutlineButton label="登录同步" onPress={onRequestSignIn} variant="primary" />
            )}
          </View>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileCell}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
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
    backgroundColor: colors.surfaceTint,
    gap: spacing.lg
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg
  },
  avatarTrigger: {
    position: "relative"
  },
  avatarTriggerPressed: {
    opacity: 0.9
  },
  avatarEditBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borders.standard,
    borderColor: colors.surface
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  heroEyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4
  },
  heroName: {
    color: colors.text,
    fontSize: typography.titleMedium,
    lineHeight: 38,
    fontWeight: "800"
  },
  heroCondition: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  heroEmail: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  avatarHintRow: {
    gap: spacing.sm
  },
  avatarModeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  avatarModeBadgeText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  avatarHintText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  heroActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
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
  accountActionRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingTop: spacing.sm
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
