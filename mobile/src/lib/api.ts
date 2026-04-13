import { loadToken } from "./auth";
import { loadStoredHealthProfile, saveStoredHealthProfile } from "./healthProfileStorage";
import { mockHealthProfile, mockSession } from "./mock";
import {
  getFallbackChatThread,
  getFallbackDashboardSnapshot,
  getFallbackHealthProfile,
  hydrateFallbackProfile,
  saveFallbackHealthProfile,
  sendFallbackChatMessage,
  submitFallbackDashboardFeedback
} from "./mockStore";
import { getTodayString, parseLeadingNumber } from "./utils";
import type {
  AuthSession,
  ChatThread,
  ChatSendPayload,
  ChatSendResult,
  DashboardFeedbackPayload,
  DashboardSnapshot,
  HealthProfile
} from "../types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "";

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  nickname?: string;
};

type ServerProfileResponse = {
  email?: string | null;
  nickname?: string | null;
  age?: number | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  careFocus?: string | null;
  healthGoal?: string | null;
  updatedAt?: string | null;
};

type ServerDashboardResponse = {
  focusDate: string;
  dietCount: number;
  exerciseCount: number;
  careCount: number;
  totalCalories: number;
  totalExerciseMinutes: number;
  totalCareMinutes: number;
  dailyCalorieGoal: number;
  weeklyExerciseGoalMinutes: number;
  goalCompletionRate: number;
  weeklyActivity: Array<{
    date: string;
    calories: number;
    exerciseMinutes: number;
    careMinutes: number;
  }>;
  latestAdvice: string;
};

type ServerAdviceResponse = {
  adviceDate: string;
  adviceText: string;
  source: string;
  status: string;
  generatedAt: string;
};

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

async function request<T>(path: string, init: RequestInit = {}, fallback?: T | (() => T)): Promise<T> {
  const resolveFallback = () => (typeof fallback === "function" ? (fallback as () => T)() : fallback);

  try {
    const token = await loadToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(buildUrl(path), {
      ...init,
      headers
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (response.status === 204) {
      return resolveFallback() as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (fallback !== undefined) {
      return resolveFallback() as T;
    }

    throw error;
  }
}

export const api = {
  login(payload: LoginPayload) {
    return request<AuthSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  register(payload: RegisterPayload) {
    return request<AuthSession>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getHealthProfile() {
    const stored = await loadStoredHealthProfile();

    try {
      const remote = await request<ServerProfileResponse>("/api/profile");
      const merged: HealthProfile = {
        ...mockHealthProfile,
        ...stored,
        email: remote.email ?? stored?.email ?? mockSession.email,
        nickname: remote.nickname ?? stored?.nickname ?? mockHealthProfile.nickname,
        avatarPresetId: stored?.avatarPresetId ?? mockHealthProfile.avatarPresetId,
        avatarUri: stored?.avatarUri ?? mockHealthProfile.avatarUri,
        age: remote.age ?? stored?.age ?? mockHealthProfile.age,
        biologicalSex: remote.gender ?? stored?.biologicalSex ?? mockHealthProfile.biologicalSex,
        heightCm: remote.heightCm ?? stored?.heightCm ?? mockHealthProfile.heightCm,
        weightKg: remote.weightKg ?? stored?.weightKg ?? mockHealthProfile.weightKg,
        targetWeightKg: remote.targetWeightKg ?? stored?.targetWeightKg ?? mockHealthProfile.targetWeightKg,
        careFocus: remote.careFocus ?? stored?.careFocus ?? mockHealthProfile.careFocus,
        primaryTarget: remote.healthGoal ?? stored?.primaryTarget ?? mockHealthProfile.primaryTarget,
        updatedAt: remote.updatedAt ?? stored?.updatedAt ?? new Date().toISOString(),
        completedAt: stored?.completedAt ?? new Date().toISOString()
      };

      await saveStoredHealthProfile(merged);
      hydrateFallbackProfile(merged);
      return merged;
    } catch {
      const fallback = stored ?? getFallbackHealthProfile();
      hydrateFallbackProfile(fallback);
      return fallback;
    }
  },

  async saveHealthProfile(payload: HealthProfile) {
    const localProfile = saveFallbackHealthProfile({
      ...payload,
      updatedAt: new Date().toISOString(),
      completedAt: payload.completedAt || new Date().toISOString()
    });

    await saveStoredHealthProfile(localProfile);
    hydrateFallbackProfile(localProfile);

    try {
      const remote = await request<ServerProfileResponse>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          nickname: payload.nickname,
          age: payload.age,
          gender: payload.biologicalSex,
          heightCm: payload.heightCm,
          weightKg: payload.weightKg,
          targetWeightKg: payload.targetWeightKg,
          careFocus: payload.careFocus,
          healthGoal: payload.primaryTarget
        })
      });

      const merged: HealthProfile = {
        ...localProfile,
        email: remote.email ?? localProfile.email,
        nickname: remote.nickname ?? localProfile.nickname,
        avatarPresetId: localProfile.avatarPresetId,
        avatarUri: localProfile.avatarUri,
        age: remote.age ?? localProfile.age,
        biologicalSex: remote.gender ?? localProfile.biologicalSex,
        heightCm: remote.heightCm ?? localProfile.heightCm,
        weightKg: remote.weightKg ?? localProfile.weightKg,
        targetWeightKg: remote.targetWeightKg ?? localProfile.targetWeightKg,
        careFocus: remote.careFocus ?? localProfile.careFocus,
        primaryTarget: remote.healthGoal ?? localProfile.primaryTarget,
        updatedAt: remote.updatedAt ?? localProfile.updatedAt
      };

      await saveStoredHealthProfile(merged);
      hydrateFallbackProfile(merged);
      return merged;
    } catch {
      return localProfile;
    }
  },

  async getDashboardSnapshot(date?: string) {
    const profile = await this.getHealthProfile();
    hydrateFallbackProfile(profile);

    return request<DashboardSnapshot>(`/api/dashboard/snapshot${buildQuery({ date })}`, {}, () => getFallbackDashboardSnapshot(date));
  },

  async getChatThread(date?: string) {
    const profile = await this.getHealthProfile();
    hydrateFallbackProfile(profile);
    return request<ChatThread>(`/api/interaction/thread${buildQuery({ date })}`, {}, () => getFallbackChatThread(date));
  },

  sendChatMessage(payload: ChatSendPayload) {
    return request<ChatSendResult>(
      "/api/interaction/messages",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      () => sendFallbackChatMessage(payload)
    );
  },

  submitAdjustmentFeedback(payload: DashboardFeedbackPayload) {
    return request<DashboardSnapshot>(
      "/api/dashboard/adjustment-feedback",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      () => submitFallbackDashboardFeedback(payload)
    );
  }
};
