import type { BuildProfileDetailContentArgs, DetailContent } from "./profileDetailContentTypes";

function resolveSyncLabel(session: BuildProfileDetailContentArgs["session"]) {
  return session ? "云端已同步" : "本机临时保存";
}

export function buildPrivacyDetailContent({
  maskedIdentifier,
  session,
  onEditHealthProfile,
  onRequestSignIn
}: BuildProfileDetailContentArgs): DetailContent {
  const syncLabel = resolveSyncLabel(session);

  return {
    badge: "数据与隐私",
    tone: "neutral",
    title: "数据与隐私",
    description: "当前版本优先保证数据边界清晰，登录后可使用专属账号空间。",
    sections: [
      {
        title: "数据管理方式",
        rows: [
          { label: "数据同步状态", value: syncLabel, tone: session ? "success" : "warning" },
          { label: "账号空间", value: session ? "专属账号空间" : "游客临时空间" },
          { label: "账号标识", value: maskedIdentifier }
        ]
      },
      {
        title: "隐私说明",
        rows: [
          { label: "健康档案", value: session ? "按账号保存，便于跨设备同步" : "游客模式下仅保留本机体验" },
          { label: "日常记录", value: "通过 AI 对话完成记录与归档" }
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

export function buildSecurityDetailContent({
  maskedIdentifier,
  session,
  onLogout,
  onRequestSignIn
}: BuildProfileDetailContentArgs): DetailContent {
  const syncLabel = resolveSyncLabel(session);

  return {
    badge: "账号安全",
    tone: session ? "success" : "warning",
    title: "账号与安全",
    description: "集中查看当前登录状态、账号标识和数据保存方式。",
    sections: [
      {
        title: "账号信息",
        rows: [
          { label: "登录状态", value: session ? "已登录" : "游客身份", tone: session ? "success" : "warning" },
          { label: "账号标识", value: maskedIdentifier },
          { label: "数据同步状态", value: syncLabel, tone: session ? "success" : "warning" }
        ]
      },
      {
        title: "安全说明",
        rows: [
          { label: "资料管理", value: session ? "可编辑昵称、头像和健康基线" : "登录后可开启完整资料管理" },
          { label: "切换方式", value: "通过登录页切换账号或重新登录" }
        ]
      }
    ],
    primaryAction: session
      ? {
          label: "退出登录",
          onPress: () => void onLogout(),
          variant: "secondary"
        }
      : {
          label: "登录 / 注册",
          onPress: onRequestSignIn,
          variant: "primary"
        }
  };
}
