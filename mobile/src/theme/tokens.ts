import { Platform } from "react-native";

export const colors = {
  background: "#F4F7FA",
  backgroundAccent: "#EDF4FB",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FBFE",
  surfaceTint: "#EBF4FF",
  surfaceWarm: "#FFF7EC",
  border: "rgba(16, 35, 59, 0.08)",
  borderStrong: "rgba(16, 35, 59, 0.16)",
  divider: "#E3EAF2",
  text: "#10233B",
  textMuted: "#5B6B7E",
  textSoft: "#8A97A6",
  primary: "#2F7CF6",
  primarySoft: "#E8F1FF",
  success: "#70AE7D",
  successSoft: "#EBF7EE",
  warning: "#D99647",
  warningSoft: "#FFF4E6",
  danger: "#DD7B52",
  dangerSoft: "#FFF0EA",
  inverseSurface: "#10233B",
  inverseText: "#FFFFFF",
  pressed: "#E7EEF6",
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
      shadowColor: "#16324F",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.07,
      shadowRadius: 18
    },
    android: {
      elevation: 2
    },
    default: {}
  }) ?? {},
  lift: Platform.select({
    ios: {
      shadowColor: "#16324F",
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.1,
      shadowRadius: 24
    },
    android: {
      elevation: 3
    },
    default: {}
  }) ?? {}
} as const;
