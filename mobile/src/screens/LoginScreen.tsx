import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, InfoPill, SectionCard, TextField } from "../components/ui";
import { api } from "../lib/api";
import type { AuthSession } from "../types";

type LoginScreenProps = {
  onSignedIn: (session: AuthSession) => Promise<void>;
};

export function LoginScreen({ onSignedIn }: LoginScreenProps) {
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
      const session =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, nickname });

      await onSignedIn(session);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "请求失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <InfoPill>Android MVP</InfoPill>
          <Text style={styles.title}>健康追踪移动端</Text>
          <Text style={styles.subtitle}>
            保留现有 Spring Boot 接口，先用 Expo 打通安卓端登录、看板、记录与 AI 建议。
          </Text>

          <SectionCard>
            <Text style={styles.cardTitle}>演示账号</Text>
            <Text style={styles.demoText}>邮箱: demo@healthtrack.local</Text>
            <Text style={styles.demoText}>密码: Demo123456!</Text>
            <Text style={styles.demoHint}>后端不可用时，页面会自动回退到 mock 数据。</Text>
          </SectionCard>
        </View>

        <SectionCard>
          <View style={styles.switchRow}>
            <Button
              label="登录"
              onPress={() => setMode("login")}
              variant={mode === "login" ? "primary" : "secondary"}
            />
            <Button
              label="注册"
              onPress={() => setMode("register")}
              variant={mode === "register" ? "primary" : "secondary"}
            />
          </View>

          {mode === "register" ? (
            <TextField label="昵称" value={nickname} onChangeText={setNickname} />
          ) : null}

          <TextField
            label="邮箱"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="密码"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label={loading ? "处理中..." : mode === "login" ? "登录并进入首页" : "注册并进入首页"}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={loading}
          />
        </SectionCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 18,
    justifyContent: "center",
    backgroundColor: "#020617"
  },
  hero: {
    gap: 14
  },
  title: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "800"
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 24
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700"
  },
  demoText: {
    color: "#e2e8f0",
    fontSize: 14
  },
  demoHint: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20
  },
  switchRow: {
    flexDirection: "row",
    gap: 12
  },
  errorText: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 113, 133, 0.35)",
    backgroundColor: "rgba(251, 113, 133, 0.12)",
    color: "#fecdd3",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14
  }
});
