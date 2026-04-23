/**
 * 认证、档案、仪表盘和聊天流程共用的领域类型定义。
 */
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
  avatarPresetId?: string | null;
  avatarUri?: string | null;
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
  stepsSource?: string | null;
  sleepHours: number;
  glucoseMmol?: number | null;
  glucoseSource?: "recorded" | "derived" | "default" | string | null;
};

export type GlucoseForecastPoint = {
  hourOffset: number;
  predictedGlucoseMmol: number;
  pointType?: "measured_anchor" | "forecast" | string;
};

export type DashboardSnapshot = {
  focusDate: string;
  headline: string;
  adjustment: PlanAdjustment;
  metrics: DashboardMetric[];
  observation: string;
  refreshedAt: string;
  history: MonitoringHistoryPoint[];
  glucoseRiskLevel?: string | null;
  calibrationApplied?: boolean | null;
  peakGlucoseMmol?: number | null;
  peakHourOffset?: number | null;
  returnToBaselineHourOffset?: number | null;
  glucoseForecast8h?: GlucoseForecastPoint[];
  forecastSource?: "dify" | "local" | string | null;
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

export type StepSyncRecord = {
  recordedOn: string;
  steps: number;
  source: string;
  sourceDevice?: string | null;
  sourceTimeZone?: string | null;
  syncedAt: string;
};

export type HealthConnectSdkStatus = "available" | "unavailable" | "update_required";

export type HealthConnectSyncStatus = "unsupported" | "unavailable" | "update_required" | "needs_permission" | "ready" | "error";

export type HealthConnectSyncState = {
  status: HealthConnectSyncStatus;
  sdkStatus: HealthConnectSdkStatus;
  permissionsGranted: boolean;
  lastCheckedAt: string;
  lastReadAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  syncedDays?: number | null;
  sourceTimeZone?: string | null;
};

export type DeviceStepCounterSyncStatus = "unsupported" | "needs_permission" | "ready" | "error";

export type DeviceStepCounterSyncState = {
  status: DeviceStepCounterSyncStatus;
  sensorAvailable: boolean;
  permissionsGranted: boolean;
  backgroundSamplingEnabled: boolean;
  lastCheckedAt: string;
  lastReadAt?: string | null;
  lastSampledAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  syncedDays?: number | null;
  sourceTimeZone?: string | null;
  sourceDevice?: string | null;
  samplingIntervalMinutes?: number | null;
};
