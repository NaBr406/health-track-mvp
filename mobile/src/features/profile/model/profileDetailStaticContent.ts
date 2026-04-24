import { hasValue } from "./profilePresentation";
import type { BuildProfileDetailContentArgs, DetailContent } from "./profileDetailContentTypes";

export function buildRecordingDetailContent({ onGoToAIChat }: BuildProfileDetailContentArgs): DetailContent {
  return {
    badge: "记录方式",
    tone: "neutral",
    title: "当前记录方式",
    description: "日常记录通过 AI 对话完成，不需要再回到复杂表单里逐项填写。",
    sections: [
      {
        title: "推荐记录内容",
        rows: [
          { label: "饮食与运动", value: "餐次、热量、步行或训练情况" },
          { label: "监测数据", value: "血糖、血压、睡眠和身体感受" },
          { label: "记录方式", value: "一句话描述即可开始归档" }
        ]
      }
    ],
    primaryAction: {
      label: "去对话记录",
      onPress: onGoToAIChat,
      variant: "primary"
    }
  };
}

export function buildNotificationsDetailContent(): DetailContent {
  return {
    badge: "通知设置",
    tone: "neutral",
    title: "通知设置",
    description: "当前版本先保留设置入口，后续会补充更完整的提醒能力。",
    sections: [
      {
        title: "当前状态",
        rows: [
          { label: "通知能力", value: "即将开放" },
          { label: "提醒方式", value: "后续支持按记录节奏和健康计划提醒" }
        ]
      }
    ]
  };
}

export function buildAboutDetailContent(): DetailContent {
  return {
    badge: "关于我们",
    tone: "neutral",
    title: "关于生命卫士",
    description: "这是一个以对话记录为核心的健康管理 MVP，聚焦轻量建档与连续记录。",
    sections: [
      {
        title: "产品说明",
        rows: [
          { label: "核心体验", value: "档案建线 + AI 对话记录" },
          { label: "日常记录", value: "通过 AI 对话快速完成" },
          { label: "当前版本", value: "移动端 MVP" }
        ]
      }
    ]
  };
}

export function buildHelpDetailContent({
  profile,
  session,
  onEditHealthProfile,
  onGoToAIChat,
  onRequestSignIn
}: BuildProfileDetailContentArgs): DetailContent {
  return {
    badge: "帮助与反馈",
    tone: "neutral",
    title: "帮助与反馈",
    description: "如果你不确定从哪里开始，可以先完善档案，再通过 AI 对话记录每天状态。",
    sections: [
      {
        title: "使用建议",
        rows: [
          { label: "第一步", value: hasValue(profile?.nickname) ? "查看或完善健康档案" : "先完成基础建档" },
          { label: "第二步", value: "通过 AI 对话记录饮食、运动和监测数据" },
          { label: "第三步", value: "回到“我的”页面查看近 7 天趋势" }
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
