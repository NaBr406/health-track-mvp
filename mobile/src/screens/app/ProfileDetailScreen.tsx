/**
 * 档案详情页，把已保存的健康信息整理成多个只读分区展示。
 */
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OutlineButton } from "../../components/clinical";
import {
  getDisplayText,
  getMaskedAccountIdentifier,
  getProfileCompletion,
  getProfileStatus,
  getRiskSummary,
  hasValue,
  type StatusTone
} from "../../lib/profilePresentation";
import { formatDisplayDate } from "../../lib/utils";
import { colors, fonts, layout, radii, shadows, spacing, typography } from "../../theme/tokens";
import type { AuthSession, HealthProfile } from "../../types";
import type { ProfileDetailKind } from "./profileDetailTypes";

type ProfileDetailScreenProps = {
  kind: ProfileDetailKind;
  healthProfile: HealthProfile | null;
  onBack: () => void;
  onEditHealthProfile: () => void;
  onGoToAIChat: () => void;
  onLogout: () => Promise<void>;
  onRequestSignIn: () => void;
  session: AuthSession | null;
};

type DetailSection = {
  title: string;
  description?: string;
  rows: Array<{ label: string; value: string; tone?: StatusTone }>;
};

type DetailAction = {
  label: string;
  onPress: () => void;
  variant: "primary" | "secondary" | "warning" | "ghost";
};

type DetailContent = {
  badge: string;
  tone: StatusTone;
  title: string;
  description: string;
  sections: DetailSection[];
  primaryAction?: DetailAction;
  secondaryAction?: DetailAction;
};

export function ProfileDetailScreen({
  kind,
  healthProfile,
  onBack,
  onEditHealthProfile,
  onGoToAIChat,
  onLogout,
  onRequestSignIn,
  session
}: ProfileDetailScreenProps) {
  const profile = session ? healthProfile : null;
  const completion = getProfileCompletion(profile);
  const profileStatus = getProfileStatus(profile, session);
  const maskedIdentifier = getMaskedAccountIdentifier(profile, session);
  const updatedAt = profile?.updatedAt ? formatDisplayDate(profile.updatedAt.slice(0, 10)) : "暂无更新";

  const content = getDetailContent({
    kind,
    maskedIdentifier,
    onEditHealthProfile,
    onGoToAIChat,
    onLogout,
    onRequestSignIn,
    profile,
    profileStatus,
    completion,
    session,
    updatedAt
  });

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}>
              <Ionicons color={colors.text} name="chevron-back" size={20} />
            </Pressable>
            <View style={[styles.toneBadge, toneBadgeStyles[content.tone]]}>
              <Text style={[styles.toneBadgeText, toneBadgeTextStyles[content.tone]]}>{content.badge}</Text>
            </View>
          </View>

          <Text style={styles.headerTitle}>{content.title}</Text>
          <Text style={styles.headerDescription}>{content.description}</Text>
        </View>

        {content.sections.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.description ? <Text style={styles.sectionDescription}>{section.description}</Text> : null}

            <View style={styles.sectionRows}>
              {section.rows.map((row) => (
                <View key={`${section.title}-${row.label}`} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.detailValue,
                      row.tone ? detailValueToneStyles[row.tone] : null
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footerActions}>
          {content.primaryAction ? (
            <OutlineButton
              fullWidth
              label={content.primaryAction.label}
              onPress={content.primaryAction.onPress}
              variant={content.primaryAction.variant}
            />
          ) : null}
          {content.secondaryAction ? (
            <OutlineButton
              fullWidth
              label={content.secondaryAction.label}
              onPress={content.secondaryAction.onPress}
              variant={content.secondaryAction.variant}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getDetailContent({
  kind,
  maskedIdentifier,
  onEditHealthProfile,
  onGoToAIChat,
  onLogout,
  onRequestSignIn,
  profile,
  profileStatus,
  completion,
  session,
  updatedAt
}: {
  kind: ProfileDetailKind;
  maskedIdentifier: string;
  onEditHealthProfile: () => void;
  onGoToAIChat: () => void;
  onLogout: () => Promise<void>;
  onRequestSignIn: () => void;
  profile: HealthProfile | null;
  profileStatus: { label: string; tone: StatusTone };
  completion: { filledCount: number; totalCount: number; percent: number };
  session: AuthSession | null;
  updatedAt: string;
}): DetailContent {
  const syncLabel = session ? "云端已同步" : "本机临时保存";
  const riskSummary = getRiskSummary(profile);

  switch (kind) {
    case "health-profile":
      return {
        badge: "完整档案",
        tone: "neutral" as const,
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
          variant: "primary" as const
        }
      };
    case "medication":
      return {
        badge: "用药管理",
        tone: "neutral" as const,
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
          variant: "primary" as const
        },
        secondaryAction: {
          label: "去对话记录",
          onPress: onGoToAIChat,
          variant: "secondary" as const
        }
      };
    case "privacy":
      return {
        badge: "数据与隐私",
        tone: "neutral" as const,
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
          variant: "primary" as const
        }
      };
    case "security":
      return {
        badge: "账号安全",
        tone: session ? ("success" as const) : ("warning" as const),
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
              variant: "secondary" as const
            }
          : {
              label: "登录 / 注册",
              onPress: onRequestSignIn,
              variant: "primary" as const
            }
      };
    case "sync":
      return {
        badge: "同步状态",
        tone: session ? ("success" as const) : ("warning" as const),
        title: "数据同步状态",
        description: "同步状态会影响你的健康档案是否能在专属账号空间持续保存。",
        sections: [
          {
            title: "当前状态",
            rows: [
              { label: "同步结果", value: syncLabel, tone: session ? "success" : "warning" },
              { label: "最近更新", value: updatedAt },
              { label: "数据空间", value: session ? "云端账号空间" : "本机临时空间" }
            ]
          }
        ],
        primaryAction: session
          ? {
              label: "编辑资料",
              onPress: onEditHealthProfile,
              variant: "primary" as const
            }
          : {
              label: "登录 / 注册",
              onPress: onRequestSignIn,
              variant: "primary" as const
            }
      };
    case "recording":
      return {
        badge: "记录方式",
        tone: "neutral" as const,
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
          variant: "primary" as const
        }
      };
    case "notifications":
      return {
        badge: "通知设置",
        tone: "neutral" as const,
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
    case "about":
      return {
        badge: "关于我们",
        tone: "neutral" as const,
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
    case "help":
    default:
      return {
        badge: "帮助与反馈",
        tone: "neutral" as const,
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
          variant: "primary" as const
        },
        secondaryAction: {
          label: "去对话记录",
          onPress: onGoToAIChat,
          variant: "secondary" as const
        }
      };
  }
}

const toneBadgeStyles = StyleSheet.create({
  success: {
    backgroundColor: "rgba(44, 140, 107, 0.12)"
  },
  warning: {
    backgroundColor: "rgba(209, 130, 43, 0.14)"
  },
  neutral: {
    backgroundColor: colors.primarySoft
  }
});

const toneBadgeTextStyles = StyleSheet.create({
  success: {
    color: "#2C8C6B"
  },
  warning: {
    color: "#D1822B"
  },
  neutral: {
    color: colors.primary
  }
});

const detailValueToneStyles = StyleSheet.create({
  success: {
    color: "#2C8C6B"
  },
  warning: {
    color: "#D1822B"
  },
  neutral: {
    color: colors.text
  }
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: layout.pageTop,
    paddingBottom: layout.pageBottom,
    gap: spacing.lg
  },
  headerCard: {
    borderRadius: 26,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.lift
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(16, 35, 59, 0.05)",
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.86
  },
  toneBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  toneBadgeText: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleSmall,
    lineHeight: 32,
    fontWeight: "700"
  },
  headerDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  sectionCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  sectionDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  sectionRows: {
    gap: spacing.md
  },
  detailRow: {
    gap: spacing.xs
  },
  detailLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  detailValue: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
    fontWeight: "600"
  },
  footerActions: {
    gap: spacing.md
  }
});
