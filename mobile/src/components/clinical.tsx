import type { ReactNode } from "react";
import type { KeyboardTypeOptions, StyleProp, TextInputProps, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { borders, colors, fonts, radii, shadows, spacing, typography } from "../theme/tokens";

type PanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
};

type ButtonVariant = "primary" | "secondary" | "warning" | "ghost";

type OutlineButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  variant?: ButtonVariant;
};

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  secureTextEntry?: boolean;
};

export function Panel({ children, style }: PanelProps) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionHeader({ eyebrow, title, description, trailing }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

export function OutlineButton({
  label,
  onPress,
  disabled,
  selected,
  compact,
  fullWidth,
  variant = "secondary"
}: OutlineButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : null,
        fullWidth ? styles.buttonFullWidth : null,
        buttonVariantStyles[variant],
        selected ? buttonSelectedStyles[variant] : null,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null
      ]}
    >
      <Text style={[styles.buttonLabel, buttonLabelStyles[variant], selected ? buttonLabelSelectedStyles[variant] : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  secureTextEntry
}: InputFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
        value={value}
      />
    </View>
  );
}

export function MonoValue({ value, unit }: { value: string; unit?: string }) {
  return (
    <Text style={styles.monoValue}>
      {value}
      {unit ? <Text style={styles.monoUnit}> {unit}</Text> : null}
    </Text>
  );
}

const buttonVariantStyles = StyleSheet.create({
  primary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  secondary: {
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  warning: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft
  },
  ghost: {
    borderColor: "transparent",
    backgroundColor: colors.primarySoft
  }
});

const buttonSelectedStyles = StyleSheet.create({
  primary: {
    borderColor: colors.primary,
    backgroundColor: colors.inverseSurface
  },
  secondary: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  warning: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft
  },
  ghost: {
    borderColor: "transparent",
    backgroundColor: colors.primary
  }
});

const buttonLabelStyles = StyleSheet.create({
  primary: {
    color: colors.inverseText
  },
  secondary: {
    color: colors.text
  },
  warning: {
    color: colors.warning
  },
  ghost: {
    color: colors.primary
  }
});

const buttonLabelSelectedStyles = StyleSheet.create({
  primary: {
    color: colors.inverseText
  },
  secondary: {
    color: colors.primary
  },
  warning: {
    color: colors.warning
  },
  ghost: {
    color: colors.inverseText
  }
});

const styles = StyleSheet.create({
  panel: {
    borderRadius: radii.lg,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionCopy: {
    flex: 1,
    gap: spacing.xs
  },
  trailing: {
    paddingTop: spacing.xxs
  },
  eyebrow: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600",
    letterSpacing: 0.4
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleSmall,
    lineHeight: 30,
    fontWeight: "700"
  },
  sectionDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  button: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  buttonCompact: {
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  buttonFullWidth: {
    flex: 1
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonPressed: {
    opacity: 0.92
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: "700"
  },
  field: {
    gap: spacing.sm
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: "600"
  },
  input: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.bodyLarge
  },
  inputMultiline: {
    minHeight: 112,
    textAlignVertical: "top"
  },
  monoValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleMedium,
    lineHeight: 38,
    fontWeight: "700"
  },
  monoUnit: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: typography.bodyLarge,
    fontWeight: "600"
  }
});
