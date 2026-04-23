import { request } from "../../../shared/api/client";
import type { AuthSession } from "../../../types";

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  nickname?: string;
};

async function login(payload: LoginPayload) {
  return request<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function register(payload: RegisterPayload) {
  return request<AuthSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export const authApi = {
  login,
  register
};
