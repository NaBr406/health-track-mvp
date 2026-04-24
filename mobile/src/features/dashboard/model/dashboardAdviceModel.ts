import { formatDateTime } from "../../../lib/utils";
import type { DashboardSnapshot } from "../../../types";
import type { AdviceCardMeta } from "./dashboardModelTypes";

export function buildAdviceCard(snapshot: DashboardSnapshot | null): AdviceCardMeta {
  if (!snapshot) {
    return {
      title: "系统正在生成今日方案",
      summary: "整理最近的对话和监测摘要后，这里会展示压缩后的今日建议。",
      parameter: "处理中",
      timestamp: "更新中"
    };
  }

  const normalizedLabel = snapshot.adjustment.parameterLabel.toUpperCase();
  let title = snapshot.adjustment.title;
  if (normalizedLabel.includes("CHO")) {
    title = `今日碳水建议 ${snapshot.adjustment.parameterDelta}`;
  } else if (normalizedLabel.includes("ACT")) {
    title = `今日活动时长建议 ${snapshot.adjustment.parameterDelta}`;
  } else if (normalizedLabel.includes("SLEEP")) {
    title = `今晚恢复窗口建议 ${snapshot.adjustment.parameterDelta}`;
  }

  return {
    title,
    summary: snapshot.adjustment.summary,
    parameter: `${snapshot.adjustment.parameterLabel} ${snapshot.adjustment.parameterDelta}`,
    timestamp: formatDateTime(snapshot.adjustment.generatedAt)
  };
}
