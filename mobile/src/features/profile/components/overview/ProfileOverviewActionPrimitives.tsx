import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing, typography } from "../../../../theme/tokens";
import type { StatusTone } from "../../model/profilePresentation";

export function HeaderActionButton({
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
      style={({ pressed }) => [
        styles.heroActionButton,
        variant === "primary" ? styles.heroActionButtonPrimary : styles.heroActionButtonSecondary,
        pressed ? styles.pressed : null
      ]}
    >
      <Ionicons color={variant === "primary" ? colors.inverseText : colors.primary} name={icon} size={16} />
      <Text style={[styles.heroActionButtonLabel, variant === "primary" ? styles.heroActionButtonLabelPrimary : styles.heroActionButtonLabelSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionHead({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <View style={[styles.statusBadge, statusBadgeToneStyles[tone]]}>
      <Text style={[styles.statusBadgeText, statusBadgeTextToneStyles[tone]]}>{label}</Text>
    </View>
  );
}

export const summaryHelperToneStyles = StyleSheet.create({
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

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.86
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
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  statusBadgeText: {
    fontSize: typography.caption,
    fontWeight: "700"
  }
});
