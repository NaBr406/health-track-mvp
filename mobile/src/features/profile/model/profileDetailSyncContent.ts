import { formatDateTime } from "../../../lib/utils";
import type { DeviceStepCounterSyncState } from "../../../types";
import type { StatusTone } from "./profilePresentation";
import type { BuildProfileDetailContentArgs, DetailContent } from "./profileDetailContentTypes";

function resolveDeviceStepCounterTone(state: DeviceStepCounterSyncState | null): StatusTone {
  if (!state) {
    return "neutral";
  }
  if (state.status === "ready") {
    return "success";
  }
  if (state.status === "needs_permission" || !state.sensorAvailable) {
    return "warning";
  }
  return "neutral";
}

function resolveDeviceStepCounterStatusLabel(state: DeviceStepCounterSyncState | null) {
  if (!state) {
    return "待检测";
  }

  if (!state.sensorAvailable) {
    return "当前设备无步数传感器";
  }

  switch (state.status) {
    case "ready":
      return "设备计步已就绪";
    case "needs_permission":
      return "等待活动识别授权";
    case "unsupported":
      return "当前平台不支持";
    case "error":
      return "最近一次读取失败";
    default:
      return "待检测";
  }
}

function formatSyncDateTime(value?: string | null, fallback = "尚未同步") {
  return value ? formatDateTime(value) : fallback;
}

export function buildProfileSyncDetailContent({
  stepSyncLoading,
  deviceStepCounterState,
  onConnectDeviceStepCounter,
  onOpenDeviceStepCounterSettings,
  onSyncStepSources,
  session,
  updatedAt
}: Pick<
  BuildProfileDetailContentArgs,
  | "stepSyncLoading"
  | "deviceStepCounterState"
  | "onConnectDeviceStepCounter"
  | "onOpenDeviceStepCounterSettings"
  | "onSyncStepSources"
  | "session"
  | "updatedAt"
>): DetailContent {
  const syncLabel = session ? "云端已同步" : "本机临时保存";
  const deviceTone = resolveDeviceStepCounterTone(deviceStepCounterState);
  const deviceStatusLabel = resolveDeviceStepCounterStatusLabel(deviceStepCounterState);
  const shouldConnectDeviceStepCounter = Boolean(
    deviceStepCounterState?.sensorAvailable && deviceStepCounterState.status === "needs_permission"
  );
  const hasReadyStepSource = deviceStepCounterState?.status === "ready";

  const primarySyncAction = shouldConnectDeviceStepCounter
    ? {
        label: stepSyncLoading ? "启用中..." : "启用设备计步",
        onPress: onConnectDeviceStepCounter,
        variant: "primary" as const
      }
    : hasReadyStepSource
      ? {
          label: stepSyncLoading ? "同步中..." : "立即同步步数",
          onPress: onSyncStepSources,
          variant: "primary" as const
        }
      : {
          label: "查看系统设置",
          onPress: onOpenDeviceStepCounterSettings,
          variant: "secondary" as const
        };

  const secondarySyncAction =
    hasReadyStepSource || shouldConnectDeviceStepCounter
      ? {
          label: "打开系统设置",
          onPress: onOpenDeviceStepCounterSettings,
          variant: "secondary" as const
        }
      : undefined;

  return {
    badge: "同步状态",
    tone: deviceTone === "success" ? ("success" as const) : ("warning" as const),
    title: "数据与步数同步",
    description: "当前只保留设备传感器记步链路。首页和近 7 天趋势只展示真实同步到的步数，不再按运动时长估算。",
    sections: [
      {
        title: "账号与云端",
        rows: [
          { label: "同步结果", value: syncLabel, tone: session ? ("success" as const) : ("warning" as const) },
          { label: "最近更新", value: updatedAt },
          { label: "数据空间", value: session ? "云端账号空间" : "本机临时空间" }
        ]
      },
      {
        title: "设备传感器",
        description: "直接读取 Android Step Counter 传感器。首次启用后需要一段采样时间，系统才会逐步形成日步数基线。",
        rows: [
          { label: "当前状态", value: deviceStatusLabel, tone: deviceTone },
          { label: "最近读取", value: formatSyncDateTime(deviceStepCounterState?.lastReadAt, "尚未读取") },
          { label: "最近采样", value: formatSyncDateTime(deviceStepCounterState?.lastSampledAt, "尚无快照") },
          { label: "最近入库", value: formatSyncDateTime(deviceStepCounterState?.lastSyncedAt, "尚未入库") },
          { label: "同步天数", value: `${deviceStepCounterState?.syncedDays ?? 0} 天` },
          {
            label: "后台采样",
            value:
              deviceStepCounterState?.backgroundSamplingEnabled
                ? `${deviceStepCounterState?.samplingIntervalMinutes ?? 15} 分钟/次`
                : "未启用"
          },
          { label: "数据来源", value: "Android Step Counter" },
          { label: "设备", value: deviceStepCounterState?.sourceDevice ?? "跟随设备" },
          { label: "时区", value: deviceStepCounterState?.sourceTimeZone ?? "跟随设备" },
          { label: "最近异常", value: deviceStepCounterState?.lastError ?? "无" }
        ]
      }
    ],
    primaryAction: primarySyncAction,
    secondaryAction: secondarySyncAction
  };
}

