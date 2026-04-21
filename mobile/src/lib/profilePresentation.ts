import type { AuthSession, HealthProfile } from "../types";

export type StatusTone = "success" | "warning" | "neutral";

const completionFields = [
  "nickname",
  "conditionLabel",
  "primaryTarget",
  "fastingGlucoseBaseline",
  "bloodPressureBaseline",
  "medicationPlan",
  "careFocus"
] as const;

export function getMaskedAccountIdentifier(profile: HealthProfile | null, session: AuthSession | null) {
  const rawValue = profile?.email || session?.email;

  if (!rawValue) {
    return "未绑定账号";
  }

  if (rawValue.includes("@")) {
    const [local, domain] = rawValue.split("@");
    const visible = local.slice(0, Math.min(2, local.length));
    const maskedLength = Math.max(2, Math.min(4, local.length - visible.length));
    return `${visible}${"*".repeat(maskedLength)}@${domain}`;
  }

  const digits = rawValue.replace(/\D/g, "");

  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  }

  return rawValue;
}

export function getProfileCompletion(profile: HealthProfile | null) {
  const filledCount = completionFields.filter((field) => hasValue(profile?.[field])).length;
  const totalCount = completionFields.length;

  return {
    filledCount,
    totalCount,
    percent: Math.round((filledCount / totalCount) * 100)
  };
}

export function getProfileStatus(profile: HealthProfile | null, session: AuthSession | null): { label: string; tone: StatusTone } {
  if (!session) {
    return {
      label: "登录后可保存专属健康档案",
      tone: "neutral"
    };
  }

  const completion = getProfileCompletion(profile);

  if (completion.percent >= 85) {
    return {
      label: "已完成基础建档",
      tone: "success"
    };
  }

  if (completion.percent >= 45) {
    return {
      label: "待补充关键指标",
      tone: "warning"
    };
  }

  return {
    label: "健康档案待完善",
    tone: "warning"
  };
}

export function getDisplayText(value?: string | number | null, emptyText = "暂未填写") {
  if (typeof value === "number") {
    return `${value}`;
  }

  if (!hasValue(value)) {
    return emptyText;
  }

  return String(value).trim();
}

export function hasValue(value?: string | number | null) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return Boolean(value && String(value).trim());
}

export function getRiskSummary(profile: HealthProfile | null) {
  if (!hasValue(profile?.notes)) {
    return null;
  }

  const note = profile?.notes?.trim() ?? "";

  if (!note) {
    return null;
  }

  return note;
}
