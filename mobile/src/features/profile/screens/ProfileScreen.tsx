/**
 * 档案主页，汇总账号状态、完善度和最近的健康洞察。
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { chatApi } from "../../chat/api/chatApi";
import { dashboardApi } from "../../dashboard/api/dashboardApi";
import { ProfileHeroCard, ProfileInsightSection, ProfileQuickActionsSection, ProfileSummarySection } from "../components/ProfileOverviewSections";
import { buildProfileOverviewState, buildQuickActions, buildSummaryCards, buildWeeklyInsight } from "../model/profileOverview";
import { isAuthExpiredError } from "../../../shared/api/client";
import { useImmersiveTabBarScroll } from "../../../navigation/ImmersiveTabBarContext";
import { colors, fonts, layout, shadows, spacing, typography } from "../../../theme/tokens";
import type { ProfileDetailKind } from "../model/profileDetailTypes";
import type { AuthSession, ChatThread, DashboardSnapshot, HealthProfile } from "../../../types";

type ProfileScreenProps = {
  healthProfile: HealthProfile | null;
  onEditHealthProfile: () => void;
  onGoToAIChat: () => void;
  onOpenDetail: (kind: ProfileDetailKind) => void;
  onOpenSettings: () => void;
  onRequestSignIn: () => void;
  session: AuthSession | null;
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
      const [nextSnapshot, nextThread] = await Promise.all([dashboardApi.getDashboardSnapshot(), chatApi.getChatThread()]);
      setSnapshot(nextSnapshot);
      setThread(nextThread);
    } catch (error) {
      if (!isAuthExpiredError(error)) {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  }

  const profile = session ? healthProfile : null;
  const overview = useMemo(
    () => buildProfileOverviewState(profile, session, snapshot, thread),
    [profile, session, snapshot, thread]
  );
  const summaryCards = useMemo(() => buildSummaryCards(profile, overview.riskSummary), [profile, overview.riskSummary]);
  const weeklyInsight = useMemo(() => buildWeeklyInsight(snapshot, thread), [snapshot, thread]);
  const quickActions = useMemo(
    () =>
      buildQuickActions({
        canEditProfile: overview.canEditProfile,
        onEditHealthProfile,
        onOpenDetail,
        onRequestSignIn
      }),
    [overview.canEditProfile, onEditHealthProfile, onOpenDetail, onRequestSignIn]
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
          <Pressable
            accessibilityRole="button"
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.settingsIconButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={colors.text} name="settings-outline" size={20} />
          </Pressable>
        </View>

        <ProfileHeroCard
          onEditHealthProfile={onEditHealthProfile}
          onOpenSecurity={() => onOpenDetail("security")}
          onRequestSignIn={onRequestSignIn}
          profile={profile}
          state={overview}
        />

        <ProfileSummarySection
          canEditProfile={overview.canEditProfile}
          onOpenHealthProfile={() => onOpenDetail("health-profile")}
          onRequestSignIn={onRequestSignIn}
          summaryCards={summaryCards}
        />

        <ProfileInsightSection loading={loading} onGoToAIChat={onGoToAIChat} weeklyInsight={weeklyInsight} />

        <ProfileQuickActionsSection quickActions={quickActions} />
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
  pressed: {
    opacity: 0.86
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
  }
});
