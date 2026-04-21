import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton } from "../../components/clinical";
import { ProfileAvatar } from "../../components/ProfileAvatar";
import {
  getDisplayText,
  getMaskedAccountIdentifier,
  getProfileCompletion,
  getProfileStatus,
  getRiskSummary,
  hasValue,
  type StatusTone
} from "../../lib/profilePresentation";
import { api } from "../../lib/api";
import { average, formatDateTime, formatDisplayDate } from "../../lib/utils";
import { useImmersiveTabBarScroll } from "../../navigation/ImmersiveTabBarContext";
import { colors, fonts, layout, radii, shadows, spacing, typography } from "../../theme/tokens";
import type { ProfileDetailKind } from "./profileDetailTypes";
import type { AuthSession, ChatThread, DashboardSnapshot, HealthProfile } from "../../types";

type ProfileScreenProps = {
  healthProfile: HealthProfile | null;
  onEditHealthProfile: () => void;
  onGoToAIChat: () => void;
  onOpenDetail: (kind: ProfileDetailKind) => void;
  onOpenSettings: () => void;
  onRequestSignIn: () => void;
  session: AuthSession | null;
};

type SummaryCard = {
  key: string;
  label: string;
  value: string;
  helper: string;
  tone: StatusTone;
};

type WeeklyInsight = {
  averageGlucose: number | null;
  averageCalories: number | null;
  averageExercise: number | null;
  hasData: boolean;
  lastRecordLabel: string;
  recordDays: number;
  statusLabel: string;
  statusTone: StatusTone;
};

export function ProfileScreen({
  healthProfile,
  onEditHealthProfile,
  onGoToAIChat,
  onOpenDetail,
  onOpenSettings,
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

  const profile = session ? healthProfile : null;
  const canEditProfile = Boolean(session);
  const completion = getProfileCompletion(profile);
  const profileStatus = getProfileStatus(profile, session);
  const maskedIdentifier = getMaskedAccountIdentifier(profile, session);
  const displayName = profile?.nickname || session?.nickname || "游客身份";
  const lastUpdatedLabel = profile?.updatedAt ? `最近更新 ${formatDisplayDate(profile.updatedAt.slice(0, 10))}` : "资料待完善";
  const riskSummary = getRiskSummary(profile);
  const dataSource = session ? snapshot?.dataSource ?? thread?.dataSource ?? "mock" : "mock";
  const syncTone = !session ? ("warning" as const) : dataSource === "server" ? ("success" as const) : ("warning" as const);
  const syncLabel = !session ? "本机临时保存" : dataSource === "server" ? "云端已同步" : "等待同步";
  const syncDescription = !session
    ? "登录后可保存专属健康档案"
    : dataSource === "server"
      ? "数据已安全保存"
      : "当前设备可继续使用";

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      {
        key: "target",
        label: "当前目标",
        value: getDisplayText(profile?.primaryTarget),
        helper: hasValue(profile?.primaryTarget) ? "持续追踪中" : "去完善",
        tone: hasValue(profile?.primaryTarget) ? "neutral" : "warning"
      },
      {
        key: "glucose",
        label: "空腹血糖基线",
        value: getDisplayText(profile?.fastingGlucoseBaseline),
        helper: hasValue(profile?.fastingGlucoseBaseline) ? "作为长期参考" : "去完善",
        tone: hasValue(profile?.fastingGlucoseBaseline) ? "neutral" : "warning"
      },
      {
        key: "pressure",
        label: "血压基线",
        value: getDisplayText(profile?.bloodPressureBaseline),
        helper: hasValue(profile?.bloodPressureBaseline) ? "作为长期参考" : "去完善",
        tone: hasValue(profile?.bloodPressureBaseline) ? "neutral" : "warning"
      },
      {
        key: "medication",
        label: "当前用药",
        value: getDisplayText(profile?.medicationPlan),
        helper: hasValue(profile?.medicationPlan) ? "查看详情" : "去完善",
        tone: hasValue(profile?.medicationPlan) ? "neutral" : "warning"
      },
      {
        key: "care",
        label: "照护重点",
        value: getDisplayText(profile?.careFocus),
        helper: hasValue(profile?.careFocus) ? "已加入档案" : "去完善",
        tone: hasValue(profile?.careFocus) ? "neutral" : "warning"
      },
      {
        key: "risk",
        label: riskSummary ? "风险提醒" : "备注摘要",
        value: getDisplayText(riskSummary ?? profile?.notes),
        helper: hasValue(riskSummary ?? profile?.notes) ? "查看全部" : "去完善",
        tone: hasValue(riskSummary ?? profile?.notes) ? "warning" : "warning"
      }
    ],
    [profile, riskSummary]
  );

  const weeklyInsight = useMemo(() => buildWeeklyInsight(snapshot, thread), [snapshot, thread]);

  const quickActions = useMemo(
    (): Array<{
      key: string;
      icon: keyof typeof Ionicons.glyphMap;
      title: string;
      helper?: string;
      onPress: () => void;
    }> => [
      {
        key: "edit",
        icon: "create-outline",
        title: "编辑资料",
        helper: canEditProfile ? undefined : "登录后可用",
        onPress: canEditProfile ? onEditHealthProfile : onRequestSignIn
      },
      {
        key: "archive",
        icon: "document-text-outline",
        title: "健康档案",
        helper: canEditProfile ? undefined : "登录后可用",
        onPress: canEditProfile ? () => onOpenDetail("health-profile") : onRequestSignIn
      },
      {
        key: "medication",
        icon: "medkit-outline",
        title: "用药管理",
        helper: canEditProfile ? undefined : "登录后可用",
        onPress: canEditProfile ? () => onOpenDetail("medication") : onRequestSignIn
      },
      {
        key: "privacy",
        icon: "shield-checkmark-outline",
        title: "数据与隐私",
        onPress: () => onOpenDetail("privacy")
      },
      {
        key: "security",
        icon: "lock-closed-outline",
        title: "账号与安全",
        helper: canEditProfile ? undefined : "登录后可用",
        onPress: canEditProfile ? () => onOpenDetail("security") : onRequestSignIn
      },
      {
        key: "help",
        icon: "help-buoy-outline",
        title: "帮助与反馈",
        onPress: () => onOpenDetail("help")
      }
    ],
    [canEditProfile, onEditHealthProfile, onOpenDetail, onRequestSignIn]
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: layout.pageBottom + bottomInset + spacing.md }]}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={scrollEventThrottle}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderCopy}>
            <Text style={styles.pageTitle}>我的</Text>
            <Text style={styles.pageSubtitle}>查看账户、档案与最近健康记录</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenSettings} style={({ pressed }) => [styles.settingsIconButton, pressed ? styles.pressed : null]}>
            <Ionicons color={colors.text} name="settings-outline" size={20} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View pointerEvents="none" style={styles.heroGlowPrimary} />
          <View pointerEvents="none" style={styles.heroGlowSecondary} />

          <View style={styles.heroTopRow}>
            <View style={styles.avatarShell}>
              <ProfileAvatar avatarUri={profile?.avatarUri} nickname={displayName} presetId={profile?.avatarPresetId} size={88} />
              <Pressable
                accessibilityRole="button"
                onPress={canEditProfile ? onEditHealthProfile : onRequestSignIn}
                style={({ pressed }) => [styles.avatarBadge, pressed ? styles.pressed : null]}
              >
                <Ionicons color={colors.inverseText} name={canEditProfile ? "create-outline" : "log-in-outline"} size={14} />
              </Pressable>
            </View>

            <View style={styles.heroCopy}>
              <View style={styles.heroBadgeRow}>
                <StatusBadge label={session ? "已登录" : "游客身份"} tone={session ? "success" : "warning"} />
                <StatusBadge label={syncLabel} tone={syncTone} />
              </View>

              <Text style={styles.heroName}>{displayName}</Text>
              <Text style={styles.heroIdentifier}>{maskedIdentifier}</Text>
              <Text style={styles.heroStatus}>{profileStatus.label}</Text>
              <Text style={styles.heroDescription}>{session ? "日常记录可通过 AI 快速完成" : "登录后可保存专属健康档案"}</Text>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressTitle}>资料完整度</Text>
              <Text style={styles.progressValue}>{completion.percent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(6, completion.percent)}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              已完善 {completion.filledCount}/{completion.totalCount} 项核心信息
            </Text>
          </View>

          <View style={styles.heroActionGroup}>
            <HeaderActionButton
              icon={canEditProfile ? "create-outline" : "log-in-outline"}
              label={canEditProfile ? "编辑资料" : "登录 / 注册"}
              onPress={canEditProfile ? onEditHealthProfile : onRequestSignIn}
              variant="primary"
            />
            <HeaderActionButton
              icon="shield-checkmark-outline"
              label="账号与安全"
              onPress={canEditProfile ? () => onOpenDetail("security") : onRequestSignIn}
              variant="secondary"
            />
          </View>

          <View style={styles.heroFootRow}>
            <Text style={styles.heroFootText}>{syncDescription}</Text>
            <Text style={styles.heroFootTextMuted}>{lastUpdatedLabel}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <SectionHead
            description="关键信息一目了然"
            title="健康档案摘要"
          />

          <View style={styles.summaryGrid}>
            {summaryCards.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.key}
                onPress={canEditProfile ? () => onOpenDetail("health-profile") : onRequestSignIn}
                style={({ pressed }) => [styles.summaryCard, pressed ? styles.pressed : null]}
              >
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text numberOfLines={3} style={[styles.summaryValue, item.value === "暂未填写" ? styles.summaryValueEmpty : null]}>
                  {item.value}
                </Text>
                <Text style={[styles.summaryHelper, summaryHelperToneStyles[item.tone]]}>{item.helper}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={canEditProfile ? () => onOpenDetail("health-profile") : onRequestSignIn}
            style={({ pressed }) => [styles.inlineActionRow, pressed ? styles.pressed : null]}
          >
            <Text style={styles.inlineActionLabel}>查看完整健康档案</Text>
            <Ionicons color={colors.primary} name="chevron-forward" size={18} />
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <SectionHead
            description={loading ? "正在更新最近一周记录" : "重点指标优先展示"}
            title="近 7 天健康趋势"
          />

          <View style={styles.highlightMetricCard}>
            <View style={styles.highlightTopRow}>
              <View>
                <Text style={styles.metricLabel}>7 日平均血糖</Text>
                {weeklyInsight.averageGlucose !== null ? (
                  <View style={styles.metricValueRow}>
                    <Text style={styles.metricValue}>{weeklyInsight.averageGlucose.toFixed(1)}</Text>
                    <Text style={styles.metricUnit}>mmol/L</Text>
                  </View>
                ) : (
                  <Text style={styles.metricPlaceholder}>暂无血糖数据</Text>
                )}
              </View>
              <StatusBadge label={weeklyInsight.statusLabel} tone={weeklyInsight.statusTone} />
            </View>

            <Text style={styles.highlightHint}>最近 7 天共记录 {weeklyInsight.recordDays} 天</Text>

            {!weeklyInsight.hasData ? (
              <View style={styles.metricActionRow}>
                <OutlineButton label="去记录" onPress={onGoToAIChat} variant="primary" />
              </View>
            ) : null}
          </View>

          <View style={styles.metricsGrid}>
            <MetricTile label="7 日记录天数" value={`${weeklyInsight.recordDays}`} unit="天" />
            <MetricTile
              label="7 日平均运动"
              value={weeklyInsight.averageExercise !== null ? `${Math.round(weeklyInsight.averageExercise)}` : "暂无记录"}
              unit={weeklyInsight.averageExercise !== null ? "min" : undefined}
            />
            <MetricTile
              label="7 日平均热量"
              value={weeklyInsight.averageCalories !== null ? `${Math.round(weeklyInsight.averageCalories)}` : "暂无记录"}
              unit={weeklyInsight.averageCalories !== null ? "kcal" : undefined}
            />
            <MetricTile label="最近一次记录" value={weeklyInsight.lastRecordLabel} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <SectionHead
            description="常用功能集中管理"
            title="快捷入口"
          />

          <View style={styles.listWrap}>
            {quickActions.map((item) => (
              <NavigationRow
                icon={item.icon}
                key={item.key}
                onPress={item.onPress}
                subtitle={item.helper}
                title={item.title}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildWeeklyInsight(snapshot: DashboardSnapshot | null, thread: ChatThread | null): WeeklyInsight {
  if (!snapshot) {
    return {
      averageGlucose: null,
      averageCalories: null,
      averageExercise: null,
      hasData: false,
      lastRecordLabel: "暂无最近记录",
      recordDays: 0,
      statusLabel: "数据不足，继续记录",
      statusTone: "warning"
    };
  }

  const history = snapshot.history ?? [];
  const glucoseValues = history
    .filter((item): item is typeof item & { glucoseMmol: number } => item.glucoseSource === "recorded" && typeof item.glucoseMmol === "number")
    .map((item) => item.glucoseMmol);
  const recordDays = history.filter(
    (item) => item.glucoseSource === "recorded" || item.calories > 0 || item.exerciseMinutes > 0 || item.steps > 0
  ).length;
  const userMessages = thread?.messages.filter((item) => item.role === "user") ?? [];
  const lastMessage = userMessages.at(-1);
  const lastRecordLabel = lastMessage ? formatDateTime(lastMessage.createdAt) : recordDays > 0 ? "本周已有记录" : "暂无最近记录";
  const averageExercise = recordDays > 0 ? average(history.map((item) => item.exerciseMinutes)) : null;
  const averageCalories = recordDays > 0 ? average(history.map((item) => item.calories)) : null;
  const hasData = recordDays > 0 || userMessages.length > 0 || glucoseValues.length > 0;

  if (!hasData) {
    return {
      averageGlucose: null,
      averageCalories: null,
      averageExercise: null,
      hasData: false,
      lastRecordLabel,
      recordDays: 0,
      statusLabel: "数据不足，继续记录",
      statusTone: "warning"
    };
  }

  if ((averageExercise ?? 0) < 20) {
    return {
      averageGlucose: glucoseValues.length > 0 ? average(glucoseValues) : null,
      averageCalories,
      averageExercise,
      hasData: true,
      lastRecordLabel,
      recordDays,
      statusLabel: "运动偏少",
      statusTone: "warning"
    };
  }

  if (glucoseValues.length >= 3) {
    return {
      averageGlucose: average(glucoseValues),
      averageCalories,
      averageExercise,
      hasData: true,
      lastRecordLabel,
      recordDays,
      statusLabel: "趋势较平稳",
      statusTone: "success"
    };
  }

  return {
    averageGlucose: glucoseValues.length > 0 ? average(glucoseValues) : null,
    averageCalories,
    averageExercise,
    hasData: true,
    lastRecordLabel,
    recordDays,
    statusLabel: "继续保持记录",
    statusTone: "neutral"
  };
}

function HeaderActionButton({
  icon,
  label,
  onPress,
  variant
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant: "primary" | "secondary";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.heroActionButton, variant === "primary" ? styles.heroActionButtonPrimary : styles.heroActionButtonSecondary, pressed ? styles.pressed : null]}
    >
      <Ionicons color={variant === "primary" ? colors.inverseText : colors.primary} name={icon} size={16} />
      <Text style={[styles.heroActionButtonLabel, variant === "primary" ? styles.heroActionButtonLabelPrimary : styles.heroActionButtonLabelSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionHead({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <View style={[styles.statusBadge, statusBadgeToneStyles[tone]]}>
      <Text style={[styles.statusBadgeText, statusBadgeTextToneStyles[tone]]}>{label}</Text>
    </View>
  );
}

function MetricTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const isEmptyText = value.startsWith("暂无");

  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricTileLabel}>{label}</Text>
      <Text numberOfLines={2} style={[styles.metricTileValue, isEmptyText ? styles.metricTileValueEmpty : null]}>
        {value}
        {unit ? <Text style={styles.metricTileUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function NavigationRow({
  icon,
  onPress,
  subtitle,
  title
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.navigationRow, pressed ? styles.pressed : null]}>
      <View style={styles.navigationIconWrap}>
        <Ionicons color={colors.primary} name={icon} size={18} />
      </View>
      <View style={styles.navigationCopy}>
        <Text style={styles.navigationTitle}>{title}</Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.navigationSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons color={colors.textSoft} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const statusBadgeToneStyles = StyleSheet.create({
  success: {
    backgroundColor: "rgba(44, 140, 107, 0.12)"
  },
  warning: {
    backgroundColor: "rgba(209, 130, 43, 0.14)"
  },
  neutral: {
    backgroundColor: colors.primarySoft
  }
});

const statusBadgeTextToneStyles = StyleSheet.create({
  success: {
    color: "#2C8C6B"
  },
  warning: {
    color: "#D1822B"
  },
  neutral: {
    color: colors.primary
  }
});

const summaryHelperToneStyles = StyleSheet.create({
  success: {
    color: "#2C8C6B"
  },
  warning: {
    color: "#D1822B"
  },
  neutral: {
    color: colors.primary
  }
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: 10,
    gap: spacing.lg
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  pageHeaderCopy: {
    flex: 1,
    gap: spacing.xs
  },
  settingsIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card
  },
  pageTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleSmall,
    fontWeight: "800"
  },
  pageSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#F5F9FF",
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.lift
  },
  heroGlowPrimary: {
    position: "absolute",
    top: -48,
    right: -34,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(0, 82, 204, 0.08)"
  },
  heroGlowSecondary: {
    position: "absolute",
    bottom: -72,
    left: -26,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(44, 140, 107, 0.08)"
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg
  },
  avatarShell: {
    position: "relative"
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.86
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  statusBadgeText: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  heroName: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800"
  },
  heroIdentifier: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  heroStatus: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  heroDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  progressWrap: {
    gap: spacing.sm
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  progressTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: "700"
  },
  progressValue: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: "800"
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(16, 35, 59, 0.08)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  progressHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  heroActionGroup: {
    flexDirection: "row",
    gap: spacing.md
  },
  heroActionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  heroActionButtonPrimary: {
    backgroundColor: colors.primary
  },
  heroActionButtonSecondary: {
    backgroundColor: colors.surface
  },
  heroActionButtonLabel: {
    fontSize: typography.body,
    fontWeight: "800"
  },
  heroActionButtonLabelPrimary: {
    color: colors.inverseText
  },
  heroActionButtonLabelSecondary: {
    color: colors.primary
  },
  heroFootRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  heroFootText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  heroFootTextMuted: {
    color: colors.textSoft,
    fontSize: typography.caption
  },
  sectionCard: {
    borderRadius: 26,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card
  },
  sectionHead: {
    gap: spacing.xs
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  sectionDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md
  },
  summaryCard: {
    width: "48.5%",
    height: 136,
    borderRadius: 20,
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
    gap: spacing.xs
  },
  summaryLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  summaryValue: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22,
    fontWeight: "700"
  },
  summaryValueEmpty: {
    color: colors.textMuted,
    fontWeight: "600"
  },
  summaryHelper: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  inlineActionRow: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md
  },
  inlineActionLabel: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: "800"
  },
  highlightMetricCard: {
    borderRadius: 24,
    backgroundColor: "#F5F9FF",
    padding: spacing.xl,
    gap: spacing.sm
  },
  highlightTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  metricLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    fontWeight: "800"
  },
  metricUnit: {
    color: colors.textSoft,
    fontSize: typography.label,
    fontWeight: "700",
    paddingBottom: 4
  },
  metricPlaceholder: {
    color: colors.textMuted,
    fontSize: typography.bodyLarge,
    lineHeight: 28,
    fontWeight: "700",
    marginTop: spacing.sm
  },
  highlightHint: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  metricActionRow: {
    paddingTop: spacing.xs
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md
  },
  metricTile: {
    width: "48.5%",
    minHeight: 108,
    borderRadius: 20,
    backgroundColor: "#F9FAFC",
    padding: spacing.md,
    gap: spacing.xs
  },
  metricTileLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  metricTileValue: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    lineHeight: 26,
    fontWeight: "800"
  },
  metricTileValueEmpty: {
    color: colors.textMuted,
    fontSize: typography.body
  },
  metricTileUnit: {
    color: colors.textSoft,
    fontSize: typography.label,
    fontWeight: "600"
  },
  listWrap: {
    borderRadius: 22,
    backgroundColor: "#F9FAFC",
    overflow: "hidden"
  },
  navigationRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(16, 35, 59, 0.08)"
  },
  navigationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  navigationCopy: {
    flex: 1,
    gap: 2
  },
  navigationTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700"
  },
  navigationSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption
  }
});
