import { getDisplayText, getRiskSummary } from "./profilePresentation";
import type { BuildProfileDetailContentArgs, DetailContent } from "./profileDetailContentTypes";

export function buildHealthProfileDetailContent({
  maskedIdentifier,
  profile,
  profileStatus,
  completion,
  session,
  onEditHealthProfile,
  onRequestSignIn,
  updatedAt
}: BuildProfileDetailContentArgs): DetailContent {
  return {
    badge: "完整档案",
    tone: "neutral",
    title: "完整健康档案",
    description: "集中查看当前账号的核心建档信息，后续可随时返回编辑。",
    sections: [
      {
        title: "基础信息",
        rows: [
          { label: "账号标识", value: maskedIdentifier },
          { label: "档案状态", value: profileStatus.label, tone: profileStatus.tone },
          { label: "资料完整度", value: `${completion.percent}%` },
          { label: "最近更新", value: updatedAt }
        ]
      },
      {
        title: "健康摘要",
        rows: [
          { label: "当前目标", value: getDisplayText(profile?.primaryTarget) },
          { label: "空腹血糖基线", value: getDisplayText(profile?.fastingGlucoseBaseline) },
          { label: "血压基线", value: getDisplayText(profile?.bloodPressureBaseline) },
          { label: "当前用药", value: getDisplayText(profile?.medicationPlan) },
          { label: "照护重点", value: getDisplayText(profile?.careFocus) },
          { label: "备注摘要", value: getDisplayText(profile?.notes) }
        ]
      }
    ],
    primaryAction: {
      label: session ? "编辑资料" : "登录 / 注册",
      onPress: session ? onEditHealthProfile : onRequestSignIn,
      variant: "primary"
    }
  };
}

export function buildMedicationDetailContent({
  profile,
  session,
  onEditHealthProfile,
  onGoToAIChat,
  onRequestSignIn
}: BuildProfileDetailContentArgs): DetailContent {
  const riskSummary = getRiskSummary(profile);

  return {
    badge: "用药管理",
    tone: "neutral",
    title: "用药与照护",
    description: "药物方案、照护重点和风险备注会一起展示，方便统一更新。",
    sections: [
      {
        title: "当前方案",
        rows: [
          { label: "当前用药", value: getDisplayText(profile?.medicationPlan) },
          { label: "照护重点", value: getDisplayText(profile?.careFocus) },
          { label: "风险提醒", value: riskSummary ?? "暂未填写", tone: riskSummary ? "warning" : "neutral" }
        ]
      },
      {
        title: "记录建议",
        description: "日常服药变化、症状感受和监测结果，建议直接通过 AI 对话补充。",
        rows: [
          { label: "更新入口", value: session ? "编辑资料" : "登录后可用" },
          { label: "日常记录", value: "通过 AI 对话快速完成" }
        ]
      }
    ],
    primaryAction: {
      label: session ? "编辑资料" : "登录 / 注册",
      onPress: session ? onEditHealthProfile : onRequestSignIn,
      variant: "primary"
    },
    secondaryAction: {
      label: "去对话记录",
      onPress: onGoToAIChat,
      variant: "secondary"
    }
  };
}
