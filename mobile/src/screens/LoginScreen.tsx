/**
 * 登录弹层内容，承载登录、注册和游客兜底入口。
 */
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { InputField, OutlineButton, Panel, SectionHeader } from "../components/clinical";
import { authApi } from "../features/auth/api/authApi";
import { useScrollFocusedInputIntoView } from "../lib/useScrollFocusedInputIntoView";
import { colors, layout, radii, spacing, typography } from "../theme/tokens";
import type { AuthSession } from "../types";

type LoginScreenProps = {
  onClose: () => void;
  onSignedIn: (session: AuthSession) => Promise<void>;
};

export function LoginScreen({ onClose, onSignedIn }: LoginScreenProps) {
  const KeyboardContainer = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const scrollRef = useRef<ScrollView>(null);
  const { onFieldFocus, onScroll, scrollEventThrottle } = useScrollFocusedInputIntoView(scrollRef);
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
          ? await authApi.login({ email, password })
          : await authApi.register({ email, password, nickname });

      await onSignedIn(nextSession);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardContainer
      {...(Platform.OS === "ios"
        ? {
            behavior: "padding" as const
          }
        : {})}
      style={styles.keyboardWrap}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        ref={scrollRef}
        scrollEventThrottle={scrollEventThrottle}
        showsVerticalScrollIndicator={false}
      >
        <Panel style={styles.sheet}>
          <SectionHeader
            eyebrow="账号切换"
            title="登录后直接进入该账号的专属数据空间"
            description="当前未登录时会使用游客模式。游客数据与账号数据彼此隔离，且游客模式下不提供建档入口；登录后才能创建或编辑账号档案。"
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

          {mode === "register" ? <InputField label="昵称" onFocus={onFieldFocus} value={nickname} onChangeText={setNickname} /> : null}

          <InputField
            autoCapitalize="none"
            keyboardType="email-address"
            label="邮箱"
            onFocus={onFieldFocus}
            value={email}
            onChangeText={setEmail}
          />
          <InputField
            autoCapitalize="none"
            label="密码"
            onFocus={onFieldFocus}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <OutlineButton
            disabled={loading}
            label={loading ? "处理中..." : mode === "login" ? "登录并进入账号数据" : "创建账号并继续"}
            onPress={() => void handleSubmit()}
            variant="primary"
          />
        </Panel>
      </ScrollView>
    </KeyboardContainer>
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
