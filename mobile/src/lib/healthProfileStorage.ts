import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HealthProfile } from "../types";

const HEALTH_PROFILE_KEY = "health-track-mobile-health-profile";

export async function loadStoredHealthProfile() {
  const raw = await AsyncStorage.getItem(HEALTH_PROFILE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as HealthProfile;
  } catch {
    return null;
  }
}

export async function saveStoredHealthProfile(profile: HealthProfile) {
  await AsyncStorage.setItem(HEALTH_PROFILE_KEY, JSON.stringify(profile));
}

export async function clearStoredHealthProfile() {
  await AsyncStorage.removeItem(HEALTH_PROFILE_KEY);
}
