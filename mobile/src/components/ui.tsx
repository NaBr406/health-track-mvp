import type { PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View
} from "react-native";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function SectionCard({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({ label, onPress, variant = "primary", disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === "primary" ? styles.primaryButton : styles.secondaryButton,
        disabled ? styles.disabledButton : null
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === "primary" ? styles.primaryButtonLabel : styles.secondaryButtonLabel
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TextField({ label, hint, multiline, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#64748b"
        style={[styles.input, multiline ? styles.multilineInput : null, style]}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </View>
  );
}

export function InfoPill({ children }: PropsWithChildren) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function EmptyState({ children }: PropsWithChildren) {
  return <Text style={styles.emptyText}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 18,
    gap: 14
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc"
  },
  button: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryButton: {
    backgroundColor: "#34d399"
  },
  secondaryButton: {
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#334155"
  },
  disabledButton: {
    opacity: 0.5
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "700"
  },
  primaryButtonLabel: {
    color: "#052e2b"
  },
  secondaryButtonLabel: {
    color: "#e2e8f0"
  },
  fieldWrap: {
    gap: 8
  },
  fieldLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600"
  },
  fieldHint: {
    color: "#64748b",
    fontSize: 12
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15
  },
  multilineInput: {
    minHeight: 96
  },
  metricCard: {
    flex: 1,
    minWidth: 148,
    borderRadius: 20,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    gap: 6
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 12
  },
  metricValue: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700"
  },
  metricHelper: {
    color: "#64748b",
    fontSize: 12
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  pillText: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "600"
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 22
  }
});
