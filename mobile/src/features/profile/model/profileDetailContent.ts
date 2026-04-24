import {
  getMaskedAccountIdentifier,
  getProfileCompletion,
  getProfileStatus
} from "./profilePresentation";
import { formatDisplayDate } from "../../../lib/utils";
import { buildPrivacyDetailContent, buildSecurityDetailContent } from "./profileDetailAccountContent";
import { buildHealthProfileDetailContent, buildMedicationDetailContent } from "./profileDetailHealthContent";
import {
  buildAboutDetailContent,
  buildHelpDetailContent,
  buildNotificationsDetailContent,
  buildRecordingDetailContent
} from "./profileDetailStaticContent";
import { buildProfileSyncDetailContent } from "./profileDetailSyncContent";
import type { AuthSession, HealthProfile } from "../../../types";
import type { BuildProfileDetailContentArgs, DetailContent } from "./profileDetailContentTypes";

export type { BuildProfileDetailContentArgs, DetailAction, DetailContent, DetailSection } from "./profileDetailContentTypes";

export function buildProfileDetailContent(args: BuildProfileDetailContentArgs): DetailContent {
  switch (args.kind) {
    case "health-profile":
      return buildHealthProfileDetailContent(args);
    case "medication":
      return buildMedicationDetailContent(args);
    case "privacy":
      return buildPrivacyDetailContent(args);
    case "security":
      return buildSecurityDetailContent(args);
    case "sync":
      return buildProfileSyncDetailContent(args);
    case "recording":
      return buildRecordingDetailContent(args);
    case "notifications":
      return buildNotificationsDetailContent();
    case "about":
      return buildAboutDetailContent();
    case "help":
    default:
      return buildHelpDetailContent(args);
  }
}

export function buildProfileDetailIdentity(profile: HealthProfile | null, session: AuthSession | null) {
  const scopedProfile = session ? profile : null;

  return {
    profile: scopedProfile,
    completion: getProfileCompletion(scopedProfile),
    profileStatus: getProfileStatus(scopedProfile, session),
    maskedIdentifier: getMaskedAccountIdentifier(scopedProfile, session),
    updatedAt: scopedProfile?.updatedAt ? formatDisplayDate(scopedProfile.updatedAt.slice(0, 10)) : "暂无更新"
  };
}
