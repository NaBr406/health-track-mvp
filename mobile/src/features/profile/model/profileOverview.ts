import { Ionicons } from "@expo/vector-icons";
import {
  getMaskedAccountIdentifier,
  getProfileCompletion,
  getProfileStatus,
  getRiskSummary,
  getDisplayText,
  hasValue,
  type StatusTone
} from "./profilePresentation";
import { average, formatDateTime, formatDisplayDate } from "../../../lib/utils";
import type { ProfileDetailKind } from "./profileDetailTypes";
import type { AuthSession, ChatThread, DashboardSnapshot, HealthProfile } from "../../../types";

export type ProfileOverviewSummaryCard = {
  key: string;
  label: string;
  value: string;
  helper: string;
  tone: StatusTone;
};

export type ProfileWeeklyInsight = {
  averageGlucose: number | null;
  averageCalories: number | null;
  averageExercise: number | null;
  hasData: boolean;
  lastRecordLabel: string;
  recordDays: number;
  statusLabel: string;
  statusTone: StatusTone;
};

export type ProfileOverviewState = {
  canEditProfile: boolean;
  completion: ReturnType<typeof getProfileCompletion>;
  profileStatus: ReturnType<typeof getProfileStatus>;
  maskedIdentifier: string;
  displayName: string;
  lastUpdatedLabel: string;
  riskSummary: string | null;
  syncTone: StatusTone;
  syncLabel: string;
  syncDescription: string;
};

export type ProfileQuickAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  helper?: string;
  onPress: () => void;
};

export function buildProfileOverviewState(
  profile: HealthProfile | null,
  session: AuthSession | null,
  snapshot: DashboardSnapshot | null,
  thread: ChatThread | null
): ProfileOverviewState {
  const canEditProfile = Boolean(session);
  const completion = getProfileCompletion(profile);
  const profileStatus = getProfileStatus(profile, session);
  const maskedIdentifier = getMaskedAccountIdentifier(profile, session);
  const displayName = profile?.nickname || session?.nickname || "游客身份";
  const lastUpdatedLabel = profile?.updatedAt ? `最近更新 ${formatDisplayDate(profile.updatedAt.slice(0, 10))}` : "资料待完善";
  const riskSummary = getRiskSummary(profile);
  const dataSource = session ? snapshot?.dataSource ?? thread?.dataSource ?? "mock" : "mock";
  const syncTone = !session ? ("warning" as const) : dataSource === "server" ? ("success" as const) : ("warning" as const);
  const syncLabel = !session ? "本机临时保存" : dataSource === "server" ? "云端已同步" : "等待同步";
  const syncDescription = !session
    ? "登录后可保存专属健康档案"
    : dataSource === "server"
      ? "数据已安全保存"
      : "当前设备可继续使用";

  return {
    canEditProfile,
    completion,
    profileStatus,
    maskedIdentifier,
    displayName,
    lastUpdatedLabel,
    riskSummary,
    syncTone,
    syncLabel,
    syncDescription
  };
}

export function buildSummaryCards(profile: HealthProfile | null, riskSummary: string | null): ProfileOverviewSummaryCard[] {
  return [
    {
      key: "target",
      label: "当前目标",
      value: getDisplayText(profile?.primaryTarget),
      helper: hasValue(profile?.primaryTarget) ? "持续追踪中" : "去完善",
      tone: hasValue(profile?.primaryTarget) ? "neutral" : "warning"
    },
    {
      key: "glucose",
      label: "空腹血糖基线",
      value: getDisplayText(profile?.fastingGlucoseBaseline),
      helper: hasValue(profile?.fastingGlucoseBaseline) ? "作为长期参考" : "去完善",
      tone: hasValue(profile?.fastingGlucoseBaseline) ? "neutral" : "warning"
    },
    {
      key: "pressure",
      label: "血压基线",
      value: getDisplayText(profile?.bloodPressureBaseline),
      helper: hasValue(profile?.bloodPressureBaseline) ? "作为长期参考" : "去完善",
      tone: hasValue(profile?.bloodPressureBaseline) ? "neutral" : "warning"
    },
    {
      key: "medication",
      label: "当前用药",
      value: getDisplayText(profile?.medicationPlan),
      helper: hasValue(profile?.medicationPlan) ? "查看详情" : "去完善",
      tone: hasValue(profile?.medicationPlan) ? "neutral" : "warning"
    },
    {
      key: "care",
      label: "照护重点",
      value: getDisplayText(profile?.careFocus),
      helper: hasValue(profile?.careFocus) ? "已加入档案" : "去完善",
      tone: hasValue(profile?.careFocus) ? "neutral" : "warning"
    },
    {
      key: "risk",
      label: riskSummary ? "风险提醒" : "备注摘要",
      value: getDisplayText(riskSummary ?? profile?.notes),
      helper: hasValue(riskSummary ?? profile?.notes) ? "查看全部" : "去完善",
      tone: "warning"
    }
  ];
}

export function buildWeeklyInsight(snapshot: DashboardSnapshot | null, thread: ChatThread | null): ProfileWeeklyInsight {
  if (!snapshot) {
    return {
      averageGlucose: null,
      averageCalories: null,
      averageExercise: null,
      hasData: false,
      lastRecordLabel: "暂无最近记录",
      recordDays: 0,
      statusLabel: "数据不足，继续记录",
      statusTone: "warning"
    };
  }

  const history = snapshot.history ?? [];
  const glucoseValues = history
    .filter((item): item is typeof item & { glucoseMmol: number } => item.glucoseSource === "recorded" && typeof item.glucoseMmol === "number")
    .map((item) => item.glucoseMmol);
  const recordDays = history.filter(
    (item) => item.glucoseSource === "recorded" || item.calories > 0 || item.exerciseMinutes > 0 || item.steps > 0
  ).length;
  const userMessages = thread?.messages.filter((item) => item.role === "user") ?? [];
  const lastMessage = userMessages.at(-1);
  const lastRecordLabel = lastMessage ? formatDateTime(lastMessage.createdAt) : recordDays > 0 ? "本周已有记录" : "暂无最近记录";
  const averageExercise = recordDays > 0 ? average(history.map((item) => item.exerciseMinutes)) : null;
  const averageCalories = recordDays > 0 ? average(history.map((item) => item.calories)) : null;
  const hasData = recordDays > 0 || userMessages.length > 0 || glucoseValues.length > 0;

  if (!hasData) {
    return {
      averageGlucose: null,
      averageCalories: null,
      averageExercise: null,
      hasData: false,
      lastRecordLabel,
      recordDays: 0,
      statusLabel: "数据不足，继续记录",
      statusTone: "warning"
    };
  }

  if ((averageExercise ?? 0) < 20) {
    return {
      averageGlucose: glucoseValues.length > 0 ? average(glucoseValues) : null,
      averageCalories,
      averageExercise,
      hasData: true,
      lastRecordLabel,
      recordDays,
      statusLabel: "运动偏少",
      statusTone: "warning"
    };
  }

  if (glucoseValues.length >= 3) {
    return {
      averageGlucose: average(glucoseValues),
      averageCalories,
      averageExercise,
      hasData: true,
      lastRecordLabel,
      recordDays,
      statusLabel: "趋势较平稳",
      statusTone: "success"
    };
  }

  return {
    averageGlucose: glucoseValues.length > 0 ? average(glucoseValues) : null,
    averageCalories,
    averageExercise,
    hasData: true,
    lastRecordLabel,
    recordDays,
    statusLabel: "继续保持记录",
    statusTone: "neutral"
  };
}

export function buildQuickActions({
  canEditProfile,
  onEditHealthProfile,
  onOpenDetail,
  onRequestSignIn
}: {
  canEditProfile: boolean;
  onEditHealthProfile: () => void;
  onOpenDetail: (kind: ProfileDetailKind) => void;
  onRequestSignIn: () => void;
}): ProfileQuickAction[] {
  return [
    {
      key: "edit",
      icon: "create-outline",
      title: "编辑资料",
      helper: canEditProfile ? undefined : "登录后可用",
      onPress: canEditProfile ? onEditHealthProfile : onRequestSignIn
    },
    {
      key: "archive",
      icon: "document-text-outline",
      title: "健康档案",
      helper: canEditProfile ? undefined : "登录后可用",
      onPress: canEditProfile ? () => onOpenDetail("health-profile") : onRequestSignIn
    },
    {
      key: "medication",
      icon: "medkit-outline",
      title: "用药管理",
      helper: canEditProfile ? undefined : "登录后可用",
      onPress: canEditProfile ? () => onOpenDetail("medication") : onRequestSignIn
    },
    {
      key: "privacy",
      icon: "shield-checkmark-outline",
      title: "数据与隐私",
      onPress: () => onOpenDetail("privacy")
    },
    {
      key: "security",
      icon: "lock-closed-outline",
      title: "账号与安全",
      helper: canEditProfile ? undefined : "登录后可用",
      onPress: canEditProfile ? () => onOpenDetail("security") : onRequestSignIn
    },
    {
      key: "help",
      icon: "help-buoy-outline",
      title: "帮助与反馈",
      onPress: () => onOpenDetail("help")
    }
  ];
}
