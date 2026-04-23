import { loadStoredHealthProfile, saveStoredHealthProfile } from "../../../lib/healthProfileStorage";
import { getFallbackHealthProfile, saveFallbackHealthProfile } from "../../../lib/mockStore";
import { isAuthExpiredError, request } from "../../../shared/api/client";
import { resolveIdentity, type DataIdentity } from "../../../shared/api/identity";
import type { AuthSession, HealthProfile } from "../../../types";

type ServerProfileResponse = {
  email?: string | null;
  nickname?: string | null;
  avatarPresetId?: string | null;
  avatarUri?: string | null;
  conditionLabel?: string | null;
  fastingGlucoseBaseline?: string | null;
  bloodPressureBaseline?: string | null;
  restingHeartRate?: number | null;
  medicationPlan?: string | null;
  notes?: string | null;
  age?: number | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  careFocus?: string | null;
  healthGoal?: string | null;
  updatedAt?: string | null;
};

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value?: string | null) {
  return hasText(value) ? value.trim() : null;
}

function mergeServerProfile(remote: ServerProfileResponse, stored: HealthProfile | null, session: AuthSession | null): HealthProfile {
  const now = new Date().toISOString();

  return {
    email: remote.email ?? stored?.email ?? session?.email ?? null,
    nickname: remote.nickname ?? stored?.nickname ?? session?.nickname ?? "",
    avatarPresetId: normalizeText(remote.avatarPresetId) ?? stored?.avatarPresetId ?? null,
    avatarUri: normalizeText(remote.avatarUri) ?? stored?.avatarUri ?? null,
    conditionLabel: remote.conditionLabel ?? stored?.conditionLabel ?? "",
    fastingGlucoseBaseline: remote.fastingGlucoseBaseline ?? stored?.fastingGlucoseBaseline ?? null,
    bloodPressureBaseline: remote.bloodPressureBaseline ?? stored?.bloodPressureBaseline ?? null,
    restingHeartRate: remote.restingHeartRate ?? stored?.restingHeartRate ?? null,
    medicationPlan: remote.medicationPlan ?? stored?.medicationPlan ?? null,
    notes: remote.notes ?? stored?.notes ?? null,
    age: remote.age ?? stored?.age ?? null,
    biologicalSex: remote.gender ?? stored?.biologicalSex ?? null,
    heightCm: remote.heightCm ?? stored?.heightCm ?? null,
    weightKg: remote.weightKg ?? stored?.weightKg ?? null,
    targetWeightKg: remote.targetWeightKg ?? stored?.targetWeightKg ?? null,
    careFocus: remote.careFocus ?? stored?.careFocus ?? null,
    primaryTarget: remote.healthGoal ?? stored?.primaryTarget ?? "",
    updatedAt: remote.updatedAt ?? stored?.updatedAt ?? now,
    completedAt: stored?.completedAt ?? now
  };
}

function buildServerProfilePayload(profile: HealthProfile) {
  return {
    nickname: profile.nickname.trim(),
    avatarPresetId: normalizeText(profile.avatarPresetId),
    avatarUri: normalizeText(profile.avatarUri),
    conditionLabel: profile.conditionLabel.trim(),
    fastingGlucoseBaseline: normalizeText(profile.fastingGlucoseBaseline),
    bloodPressureBaseline: normalizeText(profile.bloodPressureBaseline),
    restingHeartRate: profile.restingHeartRate ?? null,
    medicationPlan: normalizeText(profile.medicationPlan),
    notes: normalizeText(profile.notes),
    age: profile.age ?? null,
    gender: normalizeText(profile.biologicalSex),
    heightCm: profile.heightCm ?? null,
    weightKg: profile.weightKg ?? null,
    targetWeightKg: profile.targetWeightKg ?? null,
    careFocus: normalizeText(profile.careFocus),
    healthGoal: profile.primaryTarget.trim()
  };
}

function hasRecoverableStoredProfile(profile: HealthProfile | null) {
  if (!profile) {
    return false;
  }

  return Boolean(
    normalizeText(profile.avatarPresetId) ||
      normalizeText(profile.avatarUri) ||
      profile.nickname.trim() ||
      profile.conditionLabel.trim() ||
      profile.primaryTarget.trim() ||
      normalizeText(profile.fastingGlucoseBaseline) ||
      profile.weightKg != null ||
      profile.targetWeightKg != null ||
      profile.heightCm != null ||
      profile.age != null ||
      normalizeText(profile.medicationPlan) ||
      normalizeText(profile.notes)
  );
}

function isRemoteProfileEffectivelyEmpty(remote: ServerProfileResponse) {
  const meaningfulFields = [
    normalizeText(remote.conditionLabel) && normalizeText(remote.conditionLabel) !== "condition-pending",
    normalizeText(remote.healthGoal),
    normalizeText(remote.fastingGlucoseBaseline),
    normalizeText(remote.bloodPressureBaseline),
    normalizeText(remote.careFocus),
    normalizeText(remote.medicationPlan),
    remote.weightKg != null,
    remote.targetWeightKg != null,
    remote.heightCm != null,
    remote.age != null
  ];

  return meaningfulFields.filter(Boolean).length === 0;
}

function shouldRecoverServerProfile(remote: ServerProfileResponse, stored: HealthProfile | null, merged: HealthProfile) {
  if (!hasRecoverableStoredProfile(stored)) {
    return false;
  }

  const needsAvatarRecovery = Boolean(
    (normalizeText(merged.avatarPresetId) || normalizeText(merged.avatarUri)) &&
      !normalizeText(remote.avatarPresetId) &&
      !normalizeText(remote.avatarUri)
  );

  return needsAvatarRecovery || isRemoteProfileEffectivelyEmpty(remote);
}

async function persistScopedProfile(identity: DataIdentity, profile: HealthProfile) {
  await Promise.all([
    saveStoredHealthProfile(profile, identity.session),
    saveFallbackHealthProfile(identity.scopeKey, profile)
  ]);

  return profile;
}

async function loadScopedProfile(identity: DataIdentity) {
  const storedProfile = await loadStoredHealthProfile(identity.session);
  if (storedProfile) {
    return storedProfile;
  }

  return getFallbackHealthProfile(identity.scopeKey);
}

async function pushProfileToServer(profile: HealthProfile) {
  return request<ServerProfileResponse>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(buildServerProfilePayload(profile))
  });
}

async function recoverServerProfile(identity: DataIdentity, remote: ServerProfileResponse, stored: HealthProfile | null) {
  const merged = mergeServerProfile(remote, stored, identity.session);

  if (!shouldRecoverServerProfile(remote, stored, merged)) {
    return remote;
  }

  try {
    return await pushProfileToServer(merged);
  } catch {
    return remote;
  }
}

async function getHealthProfile(sessionOverride?: AuthSession | null) {
  const identity = await resolveIdentity(sessionOverride);

  if (!identity.session) {
    return loadScopedProfile(identity);
  }

  const stored = await loadScopedProfile(identity);

  try {
    const remote = await request<ServerProfileResponse>("/api/profile");
    const recovered = await recoverServerProfile(identity, remote, stored);
    const merged = mergeServerProfile(recovered, stored, identity.session);
    return persistScopedProfile(identity, merged);
  } catch (error) {
    if (isAuthExpiredError(error)) {
      throw error;
    }

    return stored;
  }
}

async function saveHealthProfile(payload: HealthProfile) {
  const identity = await resolveIdentity();
  const now = new Date().toISOString();
  const localProfile: HealthProfile = {
    ...payload,
    email: payload.email ?? identity.session?.email ?? null,
    nickname: payload.nickname.trim(),
    conditionLabel: payload.conditionLabel.trim(),
    primaryTarget: payload.primaryTarget.trim(),
    updatedAt: now,
    completedAt: payload.completedAt || now
  };

  if (!identity.session) {
    await persistScopedProfile(identity, localProfile);
    return localProfile;
  }

  const remote = await pushProfileToServer(localProfile);
  const merged = mergeServerProfile(remote, localProfile, identity.session);
  return persistScopedProfile(identity, merged);
}

export const profileApi = {
  getHealthProfile,
  saveHealthProfile
};
