import "react-native-gesture-handler";
import { useEffect, useRef, useState } from "react";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import type { NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { clearStoredSession, loadStoredSession, saveStoredSession } from "./src/lib/auth";
import { api } from "./src/lib/api";
import { loadStoredHealthProfile } from "./src/lib/healthProfileStorage";
import { loadOnboardingGatePassed, saveOnboardingGatePassed } from "./src/lib/onboardingGate";
import { MainTabsNavigator } from "./src/navigation/MainTabsNavigator";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OnboardingWizardScreen } from "./src/screens/OnboardingWizardScreen";
import { borders, colors, radii, shadows, spacing, typography } from "./src/theme/tokens";
import type { AuthSession, HealthProfile } from "./src/types";

type RootStackParamList = {
  Main: undefined;
  Onboarding: {
    mode: "initial" | "edit";
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    border: colors.border,
    text: colors.text,
    notification: colors.warning
  }
};

function hasCompletedHealthProfile(profile: HealthProfile | null) {
  return Boolean(
    profile?.nickname.trim() &&
      profile.conditionLabel.trim() &&
      profile.primaryTarget.trim() &&
      profile.fastingGlucoseBaseline?.trim() &&
      profile.bloodPressureBaseline?.trim()
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    async function bootstrap() {
      const storedSession = await loadStoredSession();
      const storedProfile = storedSession ? await loadStoredHealthProfile(storedSession) : null;
      const resolvedProfile = storedSession ? await api.getHealthProfile(storedSession) : storedProfile;
      const onboardingGatePassed = storedSession ? await loadOnboardingGatePassed(storedSession) : false;

      setSession(storedSession);
      setHealthProfile(resolvedProfile);
      setHasOnboarded(Boolean(storedSession) && (onboardingGatePassed || hasCompletedHealthProfile(resolvedProfile)));
      setBooting(false);
    }

    void bootstrap();
  }, []);

  async function handleSignedIn(nextSession: AuthSession) {
    await saveStoredSession(nextSession);
    const accountProfile = await api.getHealthProfile(nextSession);
    const onboardingGatePassed = await loadOnboardingGatePassed(nextSession);

    setSession(nextSession);
    setHealthProfile(accountProfile);
    setHasOnboarded(onboardingGatePassed || hasCompletedHealthProfile(accountProfile));
    setRefreshToken((current) => current + 1);
    setAuthOpen(false);

    navigationRef.current?.resetRoot({
      index: 0,
      routes: [
        onboardingGatePassed || hasCompletedHealthProfile(accountProfile)
          ? { name: "Main" }
          : {
              name: "Onboarding",
              params: {
                mode: "initial"
              }
            }
      ]
    });
  }

  async function handleLogout() {
    await clearStoredSession();

    setSession(null);
    setHealthProfile(null);
    setHasOnboarded(false);
    setRefreshToken((current) => current + 1);

    navigationRef.current?.resetRoot({
      index: 0,
      routes: [{ name: "Main" }]
    });
  }

  async function handleOnboardingComplete(profile: HealthProfile) {
    const editingExisting = hasCompletedHealthProfile(healthProfile);

    if (session) {
      await saveOnboardingGatePassed(session);
    }

    setHealthProfile(profile);
    setHasOnboarded(true);

    Alert.alert(editingExisting ? "资料已更新" : "健康档案完善成功");

    if (editingExisting) {
      navigationRef.current?.goBack();
      return;
    }

    navigationRef.current?.resetRoot({
      index: 0,
      routes: [{ name: "Main" }]
    });
  }

  function openOnboardingEditor() {
    navigationRef.current?.navigate("Onboarding", {
      mode: hasCompletedHealthProfile(healthProfile) ? "edit" : "initial"
    });
  }

  async function handleSkipOnboarding() {
    if (session) {
      await saveOnboardingGatePassed(session);
    }

    setHasOnboarded(true);
    navigationRef.current?.resetRoot({
      index: 0,
      routes: [{ name: "Main" }]
    });
  }

  return (
    <SafeAreaProvider>
      <View style={styles.appShell}>
        <StatusBar style="dark" />

        {booting ? (
          <View style={styles.loadingWrap}>
            <View style={styles.loadingHaloPrimary} />
            <View style={styles.loadingHaloSecondary} />
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingTitle}>生命卫士</Text>
              <Text style={styles.loadingSubtitle}>正在载入对话式健康管理界面。日常记录将统一通过 AI 交流页完成。</Text>
            </View>
          </View>
        ) : (
          <NavigationContainer ref={navigationRef} theme={navigationTheme}>
            <Stack.Navigator
              initialRouteName={session && !hasOnboarded ? "Onboarding" : "Main"}
              screenOptions={{
                animation: "fade",
                contentStyle: { backgroundColor: colors.background },
                headerShown: false
              }}
            >
              <Stack.Screen name="Main">
                {() => (
                  <MainTabsNavigator
                    healthProfile={healthProfile}
                    onConversationCommitted={() => setRefreshToken((current) => current + 1)}
                    onEditHealthProfile={openOnboardingEditor}
                    onLogout={handleLogout}
                    onRequestSignIn={() => setAuthOpen(true)}
                    refreshToken={refreshToken}
                    session={session}
                  />
                )}
              </Stack.Screen>
              {session ? (
                <Stack.Screen name="Onboarding">
                  {(screenProps) => (
                    <OnboardingWizardScreen
                      initialProfile={healthProfile}
                      mode={screenProps.route.params?.mode ?? (hasOnboarded ? "edit" : "initial")}
                      onCancel={() => {
                        if (hasOnboarded) {
                          screenProps.navigation.goBack();
                        }
                      }}
                      onComplete={handleOnboardingComplete}
                      onSkip={handleSkipOnboarding}
                    />
                  )}
                </Stack.Screen>
              ) : null}
            </Stack.Navigator>
          </NavigationContainer>
        )}

        <Modal
          animationType="fade"
          onRequestClose={() => setAuthOpen(false)}
          statusBarTranslucent
          transparent
          visible={authOpen}
        >
          <View pointerEvents="box-none" style={styles.authOverlay}>
            <Pressable style={styles.authBackdrop} onPress={() => setAuthOpen(false)} />
            <View style={styles.authSheetWrap}>
              <LoginScreen onClose={() => setAuthOpen(false)} onSignedIn={handleSignedIn} />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl
  },
  loadingHaloPrimary: {
    position: "absolute",
    top: 90,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primarySoft
  },
  loadingHaloSecondary: {
    position: "absolute",
    bottom: 120,
    left: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.warningSoft
  },
  loadingCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radii.xl,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    alignItems: "center",
    gap: spacing.md,
    ...shadows.lift
  },
  loadingTitle: {
    color: colors.text,
    fontSize: typography.titleLarge,
    fontWeight: "700"
  },
  loadingSubtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: "center"
  },
  authOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    zIndex: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl
  },
  authBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay
  },
  authSheetWrap: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    alignSelf: "center",
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    overflow: "hidden",
    elevation: 8,
    ...shadows.lift
  }
});
