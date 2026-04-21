import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession, HealthProfile } from "../types";
import { getDataScopeKey } from "./dataScope";

const HEALTH_PROFILE_KEY_PREFIX = "health-track-mobile-health-profile";

function getHealthProfileKey(session?: AuthSession | null) {
  return `${HEALTH_PROFILE_KEY_PREFIX}:${getDataScopeKey(session)}`;
}

export async function loadStoredHealthProfile(session?: AuthSession | null) {
  const raw = await AsyncStorage.getItem(getHealthProfileKey(session));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as HealthProfile;
  } catch {
    return null;
  }
}

export async function saveStoredHealthProfile(profile: HealthProfile, session?: AuthSession | null) {
  await AsyncStorage.setItem(getHealthProfileKey(session), JSON.stringify(profile));
}

export async function clearStoredHealthProfile(session?: AuthSession | null) {
  await AsyncStorage.removeItem(getHealthProfileKey(session));
}
