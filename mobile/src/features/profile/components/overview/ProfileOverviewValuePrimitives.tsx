import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../../../theme/tokens";

export function MetricTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
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

export function NavigationRow({
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

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.86
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
