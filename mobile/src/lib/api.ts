/**
 * 兼容层：保留历史 `api` 入口，内部实现已按 feature 拆分。
 */
import { authApi } from "../features/auth/api/authApi";
import { chatApi } from "../features/chat/api/chatApi";
import { dashboardApi } from "../features/dashboard/api/dashboardApi";
import { profileApi } from "../features/profile/api/profileApi";
import { deviceStepCounterApi } from "../features/steps/api/deviceStepCounterApi";

export { AuthExpiredError, isAuthExpiredError } from "../shared/api/client";

export const api = {
  ...authApi,
  ...chatApi,
  ...dashboardApi,
  ...profileApi,
  ...deviceStepCounterApi
};
