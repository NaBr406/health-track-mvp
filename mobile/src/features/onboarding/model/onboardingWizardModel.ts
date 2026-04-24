import { avatarPresets } from "../../../lib/avatarPresets";
import { safeNumber, safeText } from "../../../lib/utils";
import type { HealthProfile } from "../../../types";

export type OnboardingWizardScreenProps = {
  mode: "initial" | "edit";
  initialProfile: HealthProfile | null;
  onCancel: () => void;
  onComplete: (profile: HealthProfile) => Promise<void>;
  onSkip: () => Promise<void>;
};

export type WizardForm = {
  nickname: string;
  avatarPresetId: string;
  avatarUri: string | null;
  conditionLabel: string;
  primaryTarget: string;
  age: string;
  biologicalSex: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  fastingGlucoseBaseline: string;
  bloodPressureBaseline: string;
  restingHeartRate: string;
  medicationPlan: string;
  careFocus: string;
  notes: string;
};

export type WizardTextField = Exclude<keyof WizardForm, "avatarUri">;

export const onboardingStepMeta = [
  {
    title: "头像与昵称",
    description: "先确认你的个人识别信息。"
  },
  {
    title: "健康基线",
    description: "补充当前目标和关键基线。"
  },
  {
    title: "用药与照护重点",
    description: "记录当前方案，方便后续长期跟踪。"
  }
] as const;

export function createOnboardingForm(profile: HealthProfile | null): WizardForm {
  return {
    nickname: profile?.nickname ?? "",
    avatarPresetId: profile?.avatarPresetId ?? avatarPresets[0].id,
    avatarUri: profile?.avatarUri ?? null,
    conditionLabel: profile?.conditionLabel ?? "",
    primaryTarget: profile?.primaryTarget ?? "",
    age: profile?.age?.toString() ?? "",
    biologicalSex: profile?.biologicalSex ?? "",
    heightCm: profile?.heightCm?.toString() ?? "",
    weightKg: profile?.weightKg?.toString() ?? "",
    targetWeightKg: profile?.targetWeightKg?.toString() ?? "",
    fastingGlucoseBaseline: profile?.fastingGlucoseBaseline ?? "",
    bloodPressureBaseline: profile?.bloodPressureBaseline ?? "",
    restingHeartRate: profile?.restingHeartRate?.toString() ?? "",
    medicationPlan: profile?.medicationPlan ?? "",
    careFocus: profile?.careFocus ?? "",
    notes: profile?.notes ?? ""
  };
}

export function canProceedOnboardingStep(step: number, form: WizardForm) {
  if (step === 0) {
    return Boolean(form.nickname.trim());
  }

  if (step === 1) {
    return Boolean(form.conditionLabel.trim() && form.primaryTarget.trim() && form.fastingGlucoseBaseline.trim() && form.bloodPressureBaseline.trim());
  }

  return true;
}

export function buildOnboardingProfileDraft(initialProfile: HealthProfile | null, form: WizardForm): HealthProfile {
  const now = new Date().toISOString();

  return {
    email: initialProfile?.email,
    nickname: form.nickname.trim() || "健康用户",
    avatarPresetId: form.avatarPresetId,
    avatarUri: form.avatarUri,
    conditionLabel: form.conditionLabel.trim(),
    primaryTarget: form.primaryTarget.trim(),
    age: safeNumber(form.age),
    biologicalSex: safeText(form.biologicalSex),
    heightCm: safeNumber(form.heightCm),
    weightKg: safeNumber(form.weightKg),
    targetWeightKg: safeNumber(form.targetWeightKg),
    fastingGlucoseBaseline: safeText(form.fastingGlucoseBaseline),
    bloodPressureBaseline: safeText(form.bloodPressureBaseline),
    restingHeartRate: safeNumber(form.restingHeartRate),
    medicationPlan: safeText(form.medicationPlan),
    careFocus: safeText(form.careFocus),
    notes: safeText(form.notes),
    updatedAt: now,
    completedAt: initialProfile?.completedAt ?? now
  };
}
