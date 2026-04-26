import { invalidateStoredSession, loadToken } from "../../lib/auth";

const RELEASE_API_BASE_URL = "http://150.158.117.174";
const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const API_BASE_URL = (ENV_API_BASE_URL || RELEASE_API_BASE_URL).replace(/\/+$/, "");

export class AuthExpiredError extends Error {
  constructor(message = "Session expired. Please sign in again.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

export function isAuthExpiredError(error: unknown): error is AuthExpiredError {
  return error instanceof AuthExpiredError || (error instanceof Error && error.name === "AuthExpiredError");
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function request<T>(path: string, init: RequestInit = {}, fallback?: T | (() => T | Promise<T>)): Promise<T> {
  const resolveFallback = async () => {
    if (typeof fallback === "function") {
      return (fallback as () => T | Promise<T>)();
    }

    return fallback as T;
  };

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

    if (response.status === 401 || response.status === 403) {
      await invalidateStoredSession();
      throw new AuthExpiredError();
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (response.status === 204) {
      return (await resolveFallback()) as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (isAuthExpiredError(error)) {
      throw error;
    }

    if (fallback !== undefined) {
      return (await resolveFallback()) as T;
    }

    throw error;
  }
}
