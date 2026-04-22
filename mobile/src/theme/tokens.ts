/**
 * 移动端全局复用的设计令牌。
 */
import { Platform } from "react-native";

export const colors = {
  background: "#F7F9FC",
  backgroundAccent: "#F7F9FC",
  surface: "#FFFFFF",
  surfaceMuted: "#FFFFFF",
  surfaceTint: "#FFFFFF",
  surfaceWarm: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#D7DEE7",
  divider: "#ECEFF3",
  text: "#10233B",
  textMuted: "#64748B",
  textSoft: "#9CA3AF",
  primary: "#0052CC",
  primarySoft: "rgba(0, 82, 204, 0.08)",
  success: "#0052CC",
  successSoft: "rgba(0, 82, 204, 0.08)",
  warning: "#0052CC",
  warningSoft: "rgba(0, 82, 204, 0.08)",
  danger: "#C53D3D",
  dangerSoft: "rgba(197, 61, 61, 0.10)",
  inverseSurface: "#10233B",
  inverseText: "#FFFFFF",
  pressed: "rgba(0, 82, 204, 0.06)",
  overlay: "rgba(16, 35, 59, 0.18)"
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  jumbo: 40
} as const;

export const radii = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999
} as const;

export const typography = {
  caption: 12,
  label: 14,
  body: 16,
  bodyLarge: 18,
  titleSmall: 24,
  titleMedium: 32,
  titleLarge: 40
} as const;

export const layout = {
  pageHorizontal: 20,
  pageTop: 16,
  pageBottom: 32,
  tabBarHeight: 74
} as const;

export const borders = {
  hairline: 1,
  standard: 1
} as const;

export const fonts = {
  display: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif-medium",
    default: "sans-serif"
  }) as string,
  sans: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif",
    default: "sans-serif"
  }) as string,
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace"
  }) as string
} as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#10233B",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.04,
      shadowRadius: 16
    },
    android: {
      elevation: 1
    },
    default: {}
  }) ?? {},
  lift: Platform.select({
    ios: {
      shadowColor: "#10233B",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.07,
      shadowRadius: 22
    },
    android: {
      elevation: 2
    },
    default: {}
  }) ?? {}
} as const;
