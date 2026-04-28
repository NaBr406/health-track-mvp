import { Ionicons } from "@expo/vector-icons";

export type AdviceCardMeta = {
  title: string;
  summary: string;
  parameter: string;
  timestamp: string;
};

export type MetricCardMeta = {
  id: string;
  label: string;
  descriptor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  valueText: string;
  unitText?: string;
  statusText: string;
  helperText: string;
  progress?: number;
  inlineChart?: StepInlineChartMeta;
  chart?: GlucoseChartMeta;
};

export type StepInlineChartBarMeta = {
  label: string;
  steps: number;
  isCurrentHour: boolean;
};

export type StepInlineChartSeriesMeta = {
  kind: "bars";
  bars: StepInlineChartBarMeta[];
  maxSteps: number;
};

export type StepInlineChartEmptyMeta = {
  kind: "empty";
  emptyLabel: string;
};

export type StepInlineChartMeta = StepInlineChartSeriesMeta | StepInlineChartEmptyMeta;

export type GlucoseChartPoint = {
  label: string;
  value: number;
  pointType?: string;
  xValue: number;
};

export type GlucoseAxisItem = {
  value: number;
  label: string;
};

export type GlucoseChartSeriesMeta = {
  kind: "series";
  points: GlucoseChartPoint[];
  currentValue: number;
  xMin: number;
  xMax: number;
  minValue: number;
  maxValue: number;
  xAxisItems: GlucoseAxisItem[];
  yTicks: number[];
  footerText: string;
};

export type GlucoseChartEmptyMeta = {
  kind: "empty";
  emptyLabel: string;
  footerText: string;
};

export type GlucoseChartMeta = GlucoseChartSeriesMeta | GlucoseChartEmptyMeta;
export type GlucoseRiskTone = "safe" | "warning" | "danger";
