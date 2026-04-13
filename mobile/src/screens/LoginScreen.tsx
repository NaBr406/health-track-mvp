import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { InputField, OutlineButton, Panel, SectionHeader } from "../components/clinical";
import { api } from "../lib/api";
import { colors, layout, radii, spacing, typography } from "../theme/tokens";
import type { AuthSession } from "../types";

type LoginScreenProps = {
  onClose: () => void;
  onSignedIn: (session: AuthSession) => Promise<void>;
};

export function LoginScreen({ onClose, onSignedIn }: LoginScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@healthtrack.local");
  const [password, setPassword] = useState("Demo123456!");
  const [nickname, setNickname] = useState("Demo User");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const nextSession =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, nickname });

      await onSignedIn(nextSession);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardWrap}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Panel style={styles.sheet}>
          <SectionHeader
            eyebrow="账户同步"
            title="登录只负责同步，不再承载日常录入"
            description="你可以先以访客模式完成建档和对话记录。登录仅在需要跨设备同步时再启用。"
            trailing={<OutlineButton compact label="关闭" onPress={onClose} variant="ghost" />}
          />

          <View style={styles.demoCard}>
            <Text style={styles.demoTitle}>演示账号</Text>
            <Text style={styles.demoLine}>邮箱：demo@healthtrack.local</Text>
            <Text style={styles.demoLine}>密码：Demo123456!</Text>
          </View>

          <View style={styles.switchRow}>
            <OutlineButton fullWidth label="登录" onPress={() => setMode("login")} selected={mode === "login"} variant="ghost" />
            <OutlineButton fullWidth label="注册" onPress={() => setMode("register")} selected={mode === "register"} variant="ghost" />
          </View>

          {mode === "register" ? <InputField label="昵称" value={nickname} onChangeText={setNickname} /> : null}

          <InputField
            autoCapitalize="none"
            keyboardType="email-address"
            label="邮箱"
            value={email}
            onChangeText={setEmail}
          />
          <InputField
            autoCapitalize="none"
            label="密码"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <OutlineButton
            disabled={loading}
            label={loading ? "处理中..." : mode === "login" ? "登录并继续" : "创建账号并继续"}
            onPress={() => void handleSubmit()}
            variant="primary"
          />
        </Panel>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    width: "100%",
    backgroundColor: colors.surface
  },
  scrollContent: {
    paddingHorizontal: layout.pageHorizontal,
    paddingVertical: spacing.xxl
  },
  sheet: {
    gap: spacing.lg
  },
  demoCard: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    padding: spacing.lg,
    gap: spacing.xs
  },
  demoTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  demoLine: {
    color: colors.textMuted,
    fontSize: typography.body
  },
  switchRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  errorText: {
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    lineHeight: 22
  }
});
