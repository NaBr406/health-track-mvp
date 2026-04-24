import { StyleSheet, View } from "react-native";
import { colors, shadows, spacing } from "../../../../theme/tokens";
import { NavigationRow, SectionHead } from "./ProfileOverviewPrimitives";
import type { ProfileQuickAction } from "../../model/profileOverview";

type ProfileQuickActionsSectionProps = {
  quickActions: ProfileQuickAction[];
};

export function ProfileQuickActionsSection({ quickActions }: ProfileQuickActionsSectionProps) {
  return (
    <View style={styles.sectionCard}>
      <SectionHead description="常用功能集中管理" title="快捷入口" />

      <View style={styles.listWrap}>
        {quickActions.map((item) => (
          <NavigationRow icon={item.icon} key={item.key} onPress={item.onPress} subtitle={item.helper} title={item.title} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 26,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card
  },
  listWrap: {
    borderRadius: 22,
    backgroundColor: "#F9FAFC",
    overflow: "hidden"
  }
});
