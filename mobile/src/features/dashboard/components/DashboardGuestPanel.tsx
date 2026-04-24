import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { OutlineButton, Panel } from "../../../components/clinical";
import { colors, radii, spacing, typography } from "../../../theme/tokens";

type DashboardGuestPanelProps = {
  onRequestSignIn: () => void;
};

export function DashboardGuestPanel({ onRequestSignIn }: DashboardGuestPanelProps) {
  return (
    <Panel>
      <View style={styles.syncHeader}>
        <View style={styles.syncBadge}>
          <Ionicons color={colors.primary} name="person-outline" size={16} />
          <Text style={styles.syncBadgeText}>游客模式</Text>
        </View>
        <Text style={styles.syncTitle}>当前正在使用游客数据空间</Text>
        <Text style={styles.syncDescription}>登录后会直接切换到该账号的专属数据，游客数据会继续独立保留，不会混入账号记录。</Text>
      </View>
      <OutlineButton label="登录账号" onPress={onRequestSignIn} variant="ghost" />
    </Panel>
  );
}

const styles = StyleSheet.create({
  syncHeader: {
    gap: spacing.sm
  },
  syncBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  syncBadgeText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  syncTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  syncDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  }
});
