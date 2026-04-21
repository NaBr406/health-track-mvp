import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "../types";

function getOnboardingGateKey(session?: AuthSession | null) {
  return `health-track.onboarding-gate.${session?.userId ?? "guest"}`;
}

export async function loadOnboardingGatePassed(session?: AuthSession | null) {
  if (!session) {
    return false;
  }

  const value = await AsyncStorage.getItem(getOnboardingGateKey(session));
  return value === "passed";
}

export async function saveOnboardingGatePassed(session?: AuthSession | null) {
  if (!session) {
    return;
  }

  await AsyncStorage.setItem(getOnboardingGateKey(session), "passed");
}

export async function clearOnboardingGatePassed(session?: AuthSession | null) {
  if (!session) {
    return;
  }

  await AsyncStorage.removeItem(getOnboardingGateKey(session));
}
