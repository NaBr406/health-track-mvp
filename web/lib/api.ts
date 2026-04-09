import { getToken } from "@/lib/auth";
import {
  mockAdvice,
  mockCareRecords,
  mockDashboardSummary,
  mockDietRecords,
  mockExerciseRecords,
  mockProfile,
  mockSession
} from "@/lib/mock";
import type {
  AuthSession,
  CareRecord,
  DailyAdvice,
  DashboardSummary,
  DietRecord,
  ExerciseRecord,
  Profile
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  nickname?: string;
};

type DietRecordPayload = Omit<DietRecord, "id" | "createdAt">;
type ExerciseRecordPayload = Omit<ExerciseRecord, "id" | "createdAt">;
type CareRecordPayload = Omit<CareRecord, "id" | "createdAt">;

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

async function request<T>(path: string, init: RequestInit = {}, fallback?: T): Promise<T> {
  try {
    const token = getToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(buildUrl(path), {
      ...init,
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (response.status === 204) {
      return fallback as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

export const api = {
  login(payload: LoginPayload) {
    return request<AuthSession>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      {
        ...mockSession,
        email: payload.email,
        nickname: mockSession.nickname
      }
    );
  },

  register(payload: RegisterPayload) {
    return request<AuthSession>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      {
        ...mockSession,
        email: payload.email,
        nickname: payload.nickname || "New User"
      }
    );
  },

  getProfile() {
    return request<Profile>("/api/profile", {}, mockProfile);
  },

  updateProfile(payload: Partial<Profile>) {
    return request<Profile>(
      "/api/profile",
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      {
        ...mockProfile,
        ...payload,
        updatedAt: new Date().toISOString()
      }
    );
  },

  getDietRecords(date?: string) {
    const filtered = date
      ? mockDietRecords.filter((record) => record.recordedOn === date)
      : mockDietRecords;
    return request<DietRecord[]>(
      `/api/records/diet${buildQuery({ date })}`,
      {},
      filtered
    );
  },

  createDietRecord(payload: DietRecordPayload) {
    return request<DietRecord>(
      "/api/records/diet",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      {
        ...payload,
        id: Date.now(),
        createdAt: new Date().toISOString()
      }
    );
  },

  getExerciseRecords(date?: string) {
    const filtered = date
      ? mockExerciseRecords.filter((record) => record.recordedOn === date)
      : mockExerciseRecords;
    return request<ExerciseRecord[]>(
      `/api/records/exercise${buildQuery({ date })}`,
      {},
      filtered
    );
  },

  createExerciseRecord(payload: ExerciseRecordPayload) {
    return request<ExerciseRecord>(
      "/api/records/exercise",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      {
        ...payload,
        id: Date.now(),
        createdAt: new Date().toISOString()
      }
    );
  },

  getCareRecords(date?: string) {
    const filtered = date
      ? mockCareRecords.filter((record) => record.recordedOn === date)
      : mockCareRecords;
    return request<CareRecord[]>(
      `/api/records/care${buildQuery({ date })}`,
      {},
      filtered
    );
  },

  createCareRecord(payload: CareRecordPayload) {
    return request<CareRecord>(
      "/api/records/care",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      {
        ...payload,
        id: Date.now(),
        createdAt: new Date().toISOString()
      }
    );
  },

  getDailyAdvice(date?: string) {
    return request<DailyAdvice>(
      `/api/advice/daily${buildQuery({ date })}`,
      {},
      {
        ...mockAdvice,
        adviceDate: date || mockAdvice.adviceDate
      }
    );
  },

  getDashboardSummary(date?: string) {
    return request<DashboardSummary>(
      `/api/dashboard/summary${buildQuery({ date })}`,
      {},
      {
        ...mockDashboardSummary,
        focusDate: date || mockDashboardSummary.focusDate
      }
    );
  }
};
