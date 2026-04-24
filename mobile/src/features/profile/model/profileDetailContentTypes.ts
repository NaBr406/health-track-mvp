import type { AuthSession, DeviceStepCounterSyncState, HealthProfile } from "../../../types";
import type { StatusTone } from "./profilePresentation";
import type { ProfileDetailKind } from "./profileDetailTypes";

export type DetailSection = {
  title: string;
  description?: string;
  rows: Array<{ label: string; value: string; tone?: StatusTone }>;
};

export type DetailAction = {
  label: string;
  onPress: () => void;
  variant: "primary" | "secondary" | "warning" | "ghost";
};

export type DetailContent = {
  badge: string;
  tone: StatusTone;
  title: string;
  description: string;
  sections: DetailSection[];
  primaryAction?: DetailAction;
  secondaryAction?: DetailAction;
};

export type BuildProfileDetailContentArgs = {
  kind: ProfileDetailKind;
  stepSyncLoading: boolean;
  deviceStepCounterState: DeviceStepCounterSyncState | null;
  maskedIdentifier: string;
  onConnectDeviceStepCounter: () => void;
  onEditHealthProfile: () => void;
  onGoToAIChat: () => void;
  onLogout: () => Promise<void>;
  onOpenDeviceStepCounterSettings: () => void;
  onRequestSignIn: () => void;
  profile: HealthProfile | null;
  profileStatus: { label: string; tone: StatusTone };
  onSyncStepSources: () => void;
  completion: { filledCount: number; totalCount: number; percent: number };
  session: AuthSession | null;
  updatedAt: string;
};
