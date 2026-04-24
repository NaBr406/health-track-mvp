/**
 * 档案详情页，把已保存的健康信息整理成多个只读分区展示。
 */
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton } from "../../../components/clinical";
import { deviceStepCounterApi } from "../../steps/api/deviceStepCounterApi";
import { buildProfileDetailContent, buildProfileDetailIdentity, type DetailContent } from "../model/profileDetailContent";
import { isAuthExpiredError } from "../../../shared/api/client";
import { colors, fonts, layout, radii, shadows, spacing, typography } from "../../../theme/tokens";
import type { AuthSession, DeviceStepCounterSyncState, HealthProfile } from "../../../types";
import type { ProfileDetailKind } from "../model/profileDetailTypes";

type ProfileDetailScreenProps = {
  kind: ProfileDetailKind;
  healthProfile: HealthProfile | null;
  onBack: () => void;
  onEditHealthProfile: () => void;
  onGoToAIChat: () => void;
  onLogout: () => Promise<void>;
  onRequestSignIn: () => void;
  session: AuthSession | null;
};

export function ProfileDetailScreen({
  kind,
  healthProfile,
  onBack,
  onEditHealthProfile,
  onGoToAIChat,
  onLogout,
  onRequestSignIn,
  session
}: ProfileDetailScreenProps) {
  const identity = buildProfileDetailIdentity(healthProfile, session);
  const [deviceStepCounterState, setDeviceStepCounterState] = useState<DeviceStepCounterSyncState | null>(null);
  const [stepSyncLoading, setStepSyncLoading] = useState(false);

  async function refreshStepSyncState() {
    setDeviceStepCounterState(await deviceStepCounterApi.getDeviceStepCounterSyncStatus(session));
  }

  useEffect(() => {
    if (kind !== "sync") {
      return;
    }

    let cancelled = false;

    async function loadStepSyncState() {
      if (cancelled) {
        return;
      }

      setDeviceStepCounterState(await deviceStepCounterApi.getDeviceStepCounterSyncStatus(session));
    }

    void loadStepSyncState().catch((error) => {
      if (!isAuthExpiredError(error) && !cancelled) {
        Alert.alert("无法读取同步状态", "请稍后再试。");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [kind, session]);

  async function handleConnectDeviceStepCounter() {
    setStepSyncLoading(true);

    try {
      await deviceStepCounterApi.connectDeviceStepCounter(session);
      await refreshStepSyncState();
    } catch (error) {
      if (!isAuthExpiredError(error)) {
        Alert.alert("启用失败", "请检查活动识别权限和设备计步传感器设置。");
      }
    } finally {
      setStepSyncLoading(false);
    }
  }

  async function handleSyncStepSources() {
    setStepSyncLoading(true);

    try {
      await deviceStepCounterApi.syncStepSources(session);
      await refreshStepSyncState();
    } catch (error) {
      if (!isAuthExpiredError(error)) {
        Alert.alert("同步失败", "请稍后重试，或检查设备计步权限与系统活动识别设置。");
      }
    } finally {
      setStepSyncLoading(false);
    }
  }

  const content: DetailContent = buildProfileDetailContent({
    kind,
    stepSyncLoading,
    deviceStepCounterState,
    maskedIdentifier: identity.maskedIdentifier,
    onConnectDeviceStepCounter: handleConnectDeviceStepCounter,
    onEditHealthProfile,
    onGoToAIChat,
    onLogout,
    onOpenDeviceStepCounterSettings: () => deviceStepCounterApi.openDeviceStepCounterSettings(),
    onRequestSignIn,
    profile: identity.profile,
    profileStatus: identity.profileStatus,
    completion: identity.completion,
    onSyncStepSources: handleSyncStepSources,
    session,
    updatedAt: identity.updatedAt
  });

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}>
              <Ionicons color={colors.text} name="chevron-back" size={20} />
            </Pressable>
            <View style={[styles.toneBadge, toneBadgeStyles[content.tone]]}>
              <Text style={[styles.toneBadgeText, toneBadgeTextStyles[content.tone]]}>{content.badge}</Text>
            </View>
          </View>

          <Text style={styles.headerTitle}>{content.title}</Text>
          <Text style={styles.headerDescription}>{content.description}</Text>
        </View>

        {content.sections.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.description ? <Text style={styles.sectionDescription}>{section.description}</Text> : null}

            <View style={styles.sectionRows}>
              {section.rows.map((row) => (
                <View key={`${section.title}-${row.label}`} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text numberOfLines={2} style={[styles.detailValue, row.tone ? detailValueToneStyles[row.tone] : null]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footerActions}>
          {content.primaryAction ? (
            <OutlineButton fullWidth label={content.primaryAction.label} onPress={content.primaryAction.onPress} variant={content.primaryAction.variant} />
          ) : null}
          {content.secondaryAction ? (
            <OutlineButton fullWidth label={content.secondaryAction.label} onPress={content.secondaryAction.onPress} variant={content.secondaryAction.variant} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const toneBadgeStyles = StyleSheet.create({
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

const toneBadgeTextStyles = StyleSheet.create({
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

const detailValueToneStyles = StyleSheet.create({
  success: {
    color: "#2C8C6B"
  },
  warning: {
    color: "#D1822B"
  },
  neutral: {
    color: colors.text
  }
});

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
    backgroundColor: colors.surface,
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
    backgroundColor: "rgba(16, 35, 59, 0.05)",
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.86
  },
  toneBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  toneBadgeText: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleSmall,
    lineHeight: 32,
    fontWeight: "700"
  },
  headerDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
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
  sectionDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  sectionRows: {
    gap: spacing.md
  },
  detailRow: {
    gap: spacing.xs
  },
  detailLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  detailValue: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
    fontWeight: "600"
  },
  footerActions: {
    gap: spacing.md
  }
});
