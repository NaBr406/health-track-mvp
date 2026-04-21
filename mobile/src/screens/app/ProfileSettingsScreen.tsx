import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton } from "../../components/clinical";
import { colors, fonts, layout, radii, shadows, spacing, typography } from "../../theme/tokens";
import type { AuthSession } from "../../types";
import type { ProfileDetailKind } from "./profileDetailTypes";

type ProfileSettingsScreenProps = {
  onBack: () => void;
  onLogout: () => Promise<void>;
  onOpenDetail: (kind: ProfileDetailKind) => void;
  onRequestSignIn: () => void;
  session: AuthSession | null;
};

export function ProfileSettingsScreen({
  onBack,
  onLogout,
  onOpenDetail,
  onRequestSignIn,
  session
}: ProfileSettingsScreenProps) {
  const items: Array<{
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    onPress: () => void;
  }> = [
    {
      key: "sync",
      icon: "cloud-done-outline",
      title: "数据同步状态",
      subtitle: session ? "云端已同步" : "本机临时保存",
      onPress: () => onOpenDetail("sync")
    },
    {
      key: "recording",
      icon: "chatbubble-ellipses-outline",
      title: "当前记录方式",
      subtitle: "日常记录通过 AI 对话完成",
      onPress: () => onOpenDetail("recording")
    },
    {
      key: "notifications",
      icon: "notifications-outline",
      title: "通知设置",
      subtitle: "即将开放",
      onPress: () => onOpenDetail("notifications")
    },
    {
      key: "privacy",
      icon: "finger-print-outline",
      title: "隐私管理",
      subtitle: session ? "账号空间" : "游客模式",
      onPress: () => onOpenDetail("privacy")
    },
    {
      key: "security",
      icon: "lock-closed-outline",
      title: "账号与安全",
      subtitle: session ? "管理登录与账号信息" : "登录后可用",
      onPress: session ? () => onOpenDetail("security") : onRequestSignIn
    },
    {
      key: "about",
      icon: "information-circle-outline",
      title: "关于我们",
      onPress: () => onOpenDetail("about")
    }
  ];

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}>
              <Ionicons color={colors.text} name="chevron-back" size={20} />
            </Pressable>
            <View style={styles.headerIconWrap}>
              <Ionicons color={colors.primary} name="settings-outline" size={18} />
            </View>
          </View>

          <Text style={styles.headerTitle}>设置</Text>
          <Text style={styles.headerDescription}>主页里的设置内容已经收起到这里，便于集中管理。</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>系统与隐私</Text>
          <View style={styles.listWrap}>
            {items.map((item) => (
              <Pressable accessibilityRole="button" key={item.key} onPress={item.onPress} style={({ pressed }) => [styles.navigationRow, pressed ? styles.pressed : null]}>
                <View style={styles.navigationIconWrap}>
                  <Ionicons color={colors.primary} name={item.icon} size={18} />
                </View>
                <View style={styles.navigationCopy}>
                  <Text style={styles.navigationTitle}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text numberOfLines={1} style={styles.navigationSubtitle}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Ionicons color={colors.textSoft} name="chevron-forward" size={18} />
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.footerHint}>日常记录通过 AI 对话完成</Text>

        <OutlineButton
          fullWidth
          label={session ? "退出登录" : "登录 / 注册"}
          onPress={session ? () => void onLogout() : onRequestSignIn}
          variant={session ? "secondary" : "primary"}
        />
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
  headerCard: {
    borderRadius: 26,
    backgroundColor: "#F5F9FF",
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.lift
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.86
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleSmall,
    lineHeight: 32,
    fontWeight: "800"
  },
  headerDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  sectionCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
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
  },
  footerHint: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    paddingHorizontal: spacing.xs
  }
});
