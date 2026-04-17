import type { AuthSession, HealthProfile, MonitoringHistoryPoint } from "../types";
import { getDateOffsetString, getTodayString } from "./utils";

export const mockSession: AuthSession = {
  token: "mock-token-for-demo",
  userId: 1,
  email: "demo@healthtrack.local",
  nickname: "临床演示账号"
};

export const mockHealthProfile: HealthProfile = {
  email: mockSession.email,
  nickname: "林岚",
  avatarPresetId: "pulse",
  avatarUri: null,
  conditionLabel: "2 型糖尿病",
  primaryTarget: "降低餐后波动并稳定体重",
  age: 42,
  biologicalSex: "女",
  heightCm: 165,
  weightKg: 68.4,
  targetWeightKg: 64,
  fastingGlucoseBaseline: "7.2 mmol/L",
  bloodPressureBaseline: "128/82 mmHg",
  restingHeartRate: 74,
  medicationPlan: "二甲双胍 0.5g bid；晚间按需监测血糖。",
  careFocus: "晚饭后步行与睡前恢复流程",
  notes: "对高 GI 主食敏感，午后久坐时波动更明显。",
  updatedAt: new Date().toISOString(),
  completedAt: new Date().toISOString()
};

export const mockMonitoringHistory: MonitoringHistoryPoint[] = [
  { date: getDateOffsetString(-6), calories: 1760, exerciseMinutes: 24, steps: 5280, sleepHours: 6.4, glucoseMmol: 7.8, glucoseSource: "recorded" },
  { date: getDateOffsetString(-5), calories: 1680, exerciseMinutes: 36, steps: 6840, sleepHours: 7.1, glucoseMmol: 7.1, glucoseSource: "recorded" },
  { date: getDateOffsetString(-4), calories: 1825, exerciseMinutes: 18, steps: 4620, sleepHours: 6.0, glucoseMmol: 8.2, glucoseSource: "recorded" },
  { date: getDateOffsetString(-3), calories: 1710, exerciseMinutes: 42, steps: 7210, sleepHours: 7.4, glucoseMmol: 7.0, glucoseSource: "recorded" },
  { date: getDateOffsetString(-2), calories: 1595, exerciseMinutes: 31, steps: 6030, sleepHours: 6.8, glucoseMmol: 7.3, glucoseSource: "recorded" },
  { date: getDateOffsetString(-1), calories: 1660, exerciseMinutes: 28, steps: 5860, sleepHours: 6.9, glucoseMmol: 7.4, glucoseSource: "recorded" },
  { date: getTodayString(), calories: 1480, exerciseMinutes: 22, steps: 4380, sleepHours: 6.2, glucoseMmol: 7.9, glucoseSource: "recorded" }
];
