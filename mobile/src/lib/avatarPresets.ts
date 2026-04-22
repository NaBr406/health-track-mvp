/**
 * 内置头像预设及其辅助查询方法，供引导页和档案页复用。
 */
import { Ionicons } from "@expo/vector-icons";

export type AvatarPreset = {
  id: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  iconColor: string;
};

export const avatarPresets: AvatarPreset[] = [
  {
    id: "pulse",
    label: "脉搏",
    iconName: "pulse-outline",
    backgroundColor: "rgba(0, 82, 204, 0.08)",
    iconColor: "#0052CC"
  },
  {
    id: "leaf",
    label: "轻养",
    iconName: "leaf-outline",
    backgroundColor: "rgba(0, 82, 204, 0.10)",
    iconColor: "#0052CC"
  },
  {
    id: "heart",
    label: "关怀",
    iconName: "heart-outline",
    backgroundColor: "rgba(0, 82, 204, 0.12)",
    iconColor: "#0052CC"
  },
  {
    id: "sunny",
    label: "晨光",
    iconName: "sunny-outline",
    backgroundColor: "rgba(0, 82, 204, 0.14)",
    iconColor: "#0052CC"
  },
  {
    id: "moon",
    label: "安睡",
    iconName: "moon-outline",
    backgroundColor: "rgba(0, 82, 204, 0.09)",
    iconColor: "#0052CC"
  },
  {
    id: "walk",
    label: "步行",
    iconName: "walk-outline",
    backgroundColor: "rgba(0, 82, 204, 0.11)",
    iconColor: "#0052CC"
  }
];

export function resolveAvatarPreset(presetId?: string | null) {
  return avatarPresets.find((item) => item.id === presetId) ?? avatarPresets[0];
}

export function getAvatarInitials(value?: string | null) {
  const source = value?.trim();

  if (!source) {
    return "健康";
  }

  if (source.length <= 2) {
    return source;
  }

  return source.slice(0, 2);
}
