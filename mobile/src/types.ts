export type AuthSession = {
  token: string;
  userId: number;
  email: string;
  nickname: string;
};

export type Profile = {
  email: string;
  nickname: string;
  age?: number | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  dailyCalorieGoal?: number | null;
  weeklyExerciseGoalMinutes?: number | null;
  careFocus?: string | null;
  healthGoal?: string | null;
  updatedAt?: string | null;
};

export type DietRecord = {
  id: number;
  recordedOn: string;
  mealType: string;
  foodName: string;
  calories: number;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  note?: string | null;
  createdAt: string;
};

export type ExerciseRecord = {
  id: number;
  recordedOn: string;
  activityName: string;
  durationMinutes: number;
  caloriesBurned?: number | null;
  intensity?: string | null;
  note?: string | null;
  createdAt: string;
};

export type CareRecord = {
  id: number;
  recordedOn: string;
  category: string;
  itemName: string;
  durationMinutes?: number | null;
  status?: string | null;
  note?: string | null;
  createdAt: string;
};

export type DailyAdvice = {
  adviceDate: string;
  adviceText: string;
  source: string;
  status: string;
  generatedAt: string;
};

export type DailySummaryPoint = {
  date: string;
  calories: number;
  exerciseMinutes: number;
  careMinutes: number;
};

export type DashboardSummary = {
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
  weeklyActivity: DailySummaryPoint[];
  latestAdvice: string;
};
