import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { clearStoredSession, loadStoredSession, saveStoredSession } from "./src/lib/auth";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import type { AuthSession } from "./src/types";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const storedSession = await loadStoredSession();
      setSession(storedSession);
      setBooting(false);
    }

    void bootstrap();
  }, []);

  async function handleSignedIn(nextSession: AuthSession) {
    await saveStoredSession(nextSession);
    setSession(nextSession);
  }

  async function handleLogout() {
    await clearStoredSession();
    setSession(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {booting ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#34d399" size="large" />
        </View>
      ) : session ? (
        <HomeScreen session={session} onLogout={handleLogout} />
      ) : (
        <LoginScreen onSignedIn={handleSignedIn} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020617"
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
