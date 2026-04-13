export type AuthSession = {
  token: string;
  userId: number;
  email: string;
  nickname: string;
};

export type DataSource = "server" | "mock";

export type HealthProfile = {
  email?: string | null;
  nickname: string;
  conditionLabel: string;
  primaryTarget: string;
  age?: number | null;
  biologicalSex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  fastingGlucoseBaseline?: string | null;
  bloodPressureBaseline?: string | null;
  restingHeartRate?: number | null;
  medicationPlan?: string | null;
  careFocus?: string | null;
  notes?: string | null;
  updatedAt: string;
  completedAt: string;
};

export type AdjustmentFeedback = "accept" | "reject" | null;

export type PlanAdjustment = {
  id: string;
  title: string;
  summary: string;
  parameterLabel: string;
  parameterDelta: string;
  rationale: string;
  generatedAt: string;
  feedback: AdjustmentFeedback;
};

export type DashboardMetric = {
  id: string;
  label: string;
  value: string;
  unit?: string;
  descriptor: string;
  source: string;
};

export type MonitoringHistoryPoint = {
  date: string;
  calories: number;
  exerciseMinutes: number;
  steps: number;
  sleepHours: number;
  glucoseMmol: number;
};

export type DashboardSnapshot = {
  focusDate: string;
  headline: string;
  adjustment: PlanAdjustment;
  metrics: DashboardMetric[];
  observation: string;
  refreshedAt: string;
  history: MonitoringHistoryPoint[];
  dataSource: DataSource;
};

export type ChatRole = "assistant" | "user" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatThread = {
  focusDate: string;
  messages: ChatMessage[];
  dataSource: DataSource;
};

export type ChatSendPayload = {
  message: string;
  inputMode: "text" | "voice";
  focusDate?: string;
};

export type ChatSendResult = {
  focusDate: string;
  messages: ChatMessage[];
  dashboard: DashboardSnapshot;
  dataSource: DataSource;
};

export type DashboardFeedbackPayload = {
  adjustmentId: string;
  feedback: Exclude<AdjustmentFeedback, null>;
  focusDate?: string;
};
