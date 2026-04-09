import type {
  AuthSession,
  CareRecord,
  DailyAdvice,
  DashboardSummary,
  DietRecord,
  ExerciseRecord,
  Profile
} from "@/types";
import { getDateOffsetString, getTodayString } from "@/lib/utils";

const today = getTodayString();

export const mockSession: AuthSession = {
  token: "mock-token-for-demo",
  userId: 1,
  email: "demo@healthtrack.local",
  nickname: "Demo User"
};

export const mockProfile: Profile = {
  email: mockSession.email,
  nickname: mockSession.nickname,
  age: 28,
  gender: "female",
  heightCm: 165,
  weightKg: 58.5,
  targetWeightKg: 55,
  dailyCalorieGoal: 1800,
  weeklyExerciseGoalMinutes: 180,
  careFocus: "睡眠与基础护肤",
  healthGoal: "减脂并维持稳定精力",
  updatedAt: new Date().toISOString()
};

export const mockDietRecords: DietRecord[] = [
  {
    id: 1,
    recordedOn: today,
    mealType: "早餐",
    foodName: "燕麦酸奶水果碗",
    calories: 420,
    proteinGrams: 18,
    carbsGrams: 52,
    fatGrams: 12,
    note: "高纤维高蛋白",
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    recordedOn: getDateOffsetString(-1),
    mealType: "午餐",
    foodName: "鸡胸肉藜麦沙拉",
    calories: 560,
    proteinGrams: 34,
    carbsGrams: 48,
    fatGrams: 17,
    note: "控制油脂摄入",
    createdAt: new Date().toISOString()
  }
];

export const mockExerciseRecords: ExerciseRecord[] = [
  {
    id: 1,
    recordedOn: today,
    activityName: "快走 + 拉伸",
    durationMinutes: 45,
    caloriesBurned: 280,
    intensity: "中等",
    note: "下班后完成",
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    recordedOn: getDateOffsetString(-2),
    activityName: "瑜伽",
    durationMinutes: 35,
    caloriesBurned: 120,
    intensity: "低",
    note: "恢复日",
    createdAt: new Date().toISOString()
  }
];

export const mockCareRecords: CareRecord[] = [
  {
    id: 1,
    recordedOn: today,
    category: "护肤",
    itemName: "晚间护肤",
    durationMinutes: 15,
    status: "completed",
    note: "清洁 + 保湿 + 修护",
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    recordedOn: getDateOffsetString(-1),
    category: "睡眠",
    itemName: "23:20 前入睡",
    durationMinutes: 480,
    status: "completed",
    note: "睡眠时长不错",
    createdAt: new Date().toISOString()
  }
];

export const mockDashboardSummary: DashboardSummary = {
  focusDate: today,
  dietCount: 1,
  exerciseCount: 1,
  careCount: 1,
  totalCalories: 420,
  totalExerciseMinutes: 45,
  totalCareMinutes: 15,
  dailyCalorieGoal: 1800,
  weeklyExerciseGoalMinutes: 180,
  goalCompletionRate: 72,
  weeklyActivity: Array.from({ length: 7 }).map((_, index) => {
    const date = getDateOffsetString(index - 6);
    return {
      date,
      calories: [530, 610, 420, 780, 520, 560, 420][index] ?? 0,
      exerciseMinutes: [20, 35, 0, 45, 30, 25, 45][index] ?? 0,
      careMinutes: [10, 15, 0, 12, 20, 8, 15][index] ?? 0
    };
  }),
  latestAdvice:
    "维持早餐高蛋白结构，今天的运动量已经不错，建议晚间再补 10 分钟拉伸，并保持睡前护理节奏。"
};

export const mockAdvice: DailyAdvice = {
  adviceDate: today,
  adviceText:
    "今日 AI 建议（Mock）：饮食上优先补优质蛋白和蔬菜，运动后注意拉伸恢复；护理上建议保持固定睡前流程。",
  source: "mock",
  status: "SUCCESS",
  generatedAt: new Date().toISOString()
};

