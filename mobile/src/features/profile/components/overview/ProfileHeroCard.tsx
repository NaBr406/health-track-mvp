import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "../../../../components/ProfileAvatar";
import { colors, fonts, shadows, spacing, typography } from "../../../../theme/tokens";
import type { HealthProfile } from "../../../../types";
import { HeaderActionButton, StatusBadge } from "./ProfileOverviewPrimitives";
import type { ProfileOverviewState } from "../../model/profileOverview";

type ProfileHeroCardProps = {
  profile: HealthProfile | null;
  state: ProfileOverviewState;
  onEditHealthProfile: () => void;
  onOpenSecurity: () => void;
  onRequestSignIn: () => void;
};

export function ProfileHeroCard({
  profile,
  state,
  onEditHealthProfile,
  onOpenSecurity,
  onRequestSignIn
}: ProfileHeroCardProps) {
  const primaryAction = state.canEditProfile ? onEditHealthProfile : onRequestSignIn;
  const secondaryAction = state.canEditProfile ? onOpenSecurity : onRequestSignIn;

  return (
    <View style={styles.heroCard}>
      <View pointerEvents="none" style={styles.heroGlowPrimary} />
      <View pointerEvents="none" style={styles.heroGlowSecondary} />

      <View style={styles.heroTopRow}>
        <View style={styles.avatarShell}>
          <ProfileAvatar avatarUri={profile?.avatarUri} nickname={state.displayName} presetId={profile?.avatarPresetId} size={88} />
          <Pressable
            accessibilityRole="button"
            onPress={primaryAction}
            style={({ pressed }) => [styles.avatarBadge, pressed ? styles.pressed : null]}
          >
            <Ionicons color={colors.inverseText} name={state.canEditProfile ? "create-outline" : "log-in-outline"} size={14} />
          </Pressable>
        </View>

        <View style={styles.heroCopy}>
          <View style={styles.heroBadgeRow}>
            <StatusBadge label={state.canEditProfile ? "已登录" : "游客身份"} tone={state.canEditProfile ? "success" : "warning"} />
            <StatusBadge label={state.syncLabel} tone={state.syncTone} />
          </View>

          <Text style={styles.heroName}>{state.displayName}</Text>
          <Text style={styles.heroIdentifier}>{state.maskedIdentifier}</Text>
          <Text style={styles.heroStatus}>{state.profileStatus.label}</Text>
          <Text style={styles.heroDescription}>{state.canEditProfile ? "日常记录可通过 AI 快速完成" : "登录后可保存专属健康档案"}</Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressTitle}>资料完整度</Text>
          <Text style={styles.progressValue}>{state.completion.percent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(6, state.completion.percent)}%` }]} />
        </View>
        <Text style={styles.progressHint}>
          已完善 {state.completion.filledCount}/{state.completion.totalCount} 项核心信息
        </Text>
      </View>

      <View style={styles.heroActionGroup}>
        <HeaderActionButton
          icon={state.canEditProfile ? "create-outline" : "log-in-outline"}
          label={state.canEditProfile ? "编辑资料" : "登录 / 注册"}
          onPress={primaryAction}
          variant="primary"
        />
        <HeaderActionButton icon="shield-checkmark-outline" label="账号与安全" onPress={secondaryAction} variant="secondary" />
      </View>

      <View style={styles.heroFootRow}>
        <Text style={styles.heroFootText}>{state.syncDescription}</Text>
        <Text style={styles.heroFootTextMuted}>{state.lastUpdatedLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  }
});
