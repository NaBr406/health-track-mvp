import type { HealthProfile } from "../../types";
import { cloneProfile, loadStore, updateStore } from "./fallbackStoreCore";

export async function getFallbackHealthProfile(scopeKey: string) {
  const store = await loadStore(scopeKey);
  return cloneProfile(store.profile);
}

export async function saveFallbackHealthProfile(scopeKey: string, profile: HealthProfile) {
  return updateStore(scopeKey, (store) => {
    store.profile = {
      ...profile,
      updatedAt: new Date().toISOString()
    };

    return cloneProfile(store.profile)!;
  });
}
