/**
 * 解析当前读写应该落到游客数据空间还是登录账号空间。
 */
import type { AuthSession } from "../types";
import { loadStoredSession } from "./auth";

export const GUEST_SCOPE_KEY = "guest";

export function getDataScopeKey(session?: AuthSession | null) {
  return session ? `user:${session.userId}` : GUEST_SCOPE_KEY;
}

export async function loadDataScope() {
  const session = await loadStoredSession();
  return {
    session,
    scopeKey: getDataScopeKey(session)
  };
}
