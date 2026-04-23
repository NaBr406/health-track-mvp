/**
 * 多步骤引导页，用于完善或编辑健康档案。
 */
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InputField, OutlineButton } from "../components/clinical";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { avatarPresets } from "../lib/avatarPresets";
import { profileApi } from "../features/profile/api/profileApi";
import { useScrollFocusedInputIntoView } from "../lib/useScrollFocusedInputIntoView";
import { safeNumber, safeText } from "../lib/utils";
import { colors, fonts, layout, radii, shadows, spacing, typography } from "../theme/tokens";
import type { HealthProfile } from "../types";

type OnboardingWizardScreenProps = {
  mode: "initial" | "edit";
  initialProfile: HealthProfile | null;
  onCancel: () => void;
  onComplete: (profile: HealthProfile) => Promise<void>;
  onSkip: () => Promise<void>;
};

type WizardForm = {
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

const stepMeta = [
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

function createForm(profile: HealthProfile | null): WizardForm {
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

export function OnboardingWizardScreen({
  mode,
  initialProfile,
  onCancel,
  onComplete,
  onSkip
}: OnboardingWizardScreenProps) {
  const KeyboardContainer = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const scrollRef = useRef<ScrollView>(null);
  const { onFieldFocus, onScroll, scrollEventThrottle } = useScrollFocusedInputIntoView(scrollRef);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(() => createForm(initialProfile));
  const [saving, setSaving] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  useEffect(() => {
    setForm(createForm(initialProfile));
    setStep(0);
  }, [initialProfile]);

  const canProceed = useMemo(() => {
    if (step === 0) {
      return Boolean(form.nickname.trim());
    }

    if (step === 1) {
      return Boolean(form.conditionLabel.trim() && form.primaryTarget.trim() && form.fastingGlucoseBaseline.trim() && form.bloodPressureBaseline.trim());
    }

    return true;
  }, [form, step]);

  const headerTitle = mode === "initial" ? "完善你的健康档案" : "编辑健康档案";
  const headerDescription = mode === "initial" ? "3 步完成基础建档，支持稍后继续完善。" : "更新头像、基线和照护重点。";

  async function handlePickCustomAvatar() {
    setPickingAvatar(true);

    try {
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("无法访问相册", "请先允许应用访问相册，以便上传头像。");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType?.startsWith("image/") ? asset.mimeType : "image/jpeg";
      const avatarUri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;

      setForm((current) => ({
        ...current,
        avatarUri
      }));
    } catch {
      Alert.alert("头像更新失败", "这次没有成功读取图片，请稍后再试。");
    } finally {
      setPickingAvatar(false);
    }
  }

  function handleSelectPreset(presetId: string) {
    setForm((current) => ({
      ...current,
      avatarPresetId: presetId,
      avatarUri: null
    }));
  }

  async function handleSubmit() {
    if (!canProceed) {
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();
      const profile = await profileApi.saveHealthProfile({
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
      });

      await onComplete(profile);
    } catch {
      Alert.alert("云端保存失败", "请检查网络后重试，避免账号资料出现不同步。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <KeyboardContainer
        {...(Platform.OS === "ios"
          ? {
              behavior: "padding" as const
            }
          : {})}
        style={styles.safeArea}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          ref={scrollRef}
          scrollEventThrottle={scrollEventThrottle}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{mode === "initial" ? "健康档案" : "资料编辑"}</Text>
              <Text style={styles.heroTitle}>{headerTitle}</Text>
              <Text style={styles.heroDescription}>{headerDescription}</Text>
            </View>

            {mode === "initial" ? (
              <OutlineButton compact label="稍后完善" onPress={() => void onSkip()} variant="ghost" />
            ) : (
              <OutlineButton compact label="关闭" onPress={onCancel} variant="ghost" />
            )}
          </View>

          <View style={styles.progressSummaryRow}>
            <View style={styles.progressChip}>
              <Text style={styles.progressChipLabel}>当前进度</Text>
              <Text style={styles.progressChipValue}>
                {step + 1}/3
              </Text>
            </View>
            <View style={styles.progressChip}>
              <Text style={styles.progressChipLabel}>完成后效果</Text>
              <Text style={styles.progressChipValue}>档案更完整</Text>
            </View>
          </View>
        </View>

          <View style={styles.stepCard}>
          <View style={styles.stepTopRow}>
            <View>
              <Text style={styles.stepLabel}>步骤 {step + 1}</Text>
              <Text style={styles.stepTitle}>{stepMeta[step].title}</Text>
              <Text style={styles.stepDescription}>{stepMeta[step].description}</Text>
            </View>
            <Text style={styles.stepFraction}>0{step + 1}/03</Text>
          </View>

          <View style={styles.stepRail}>
            {stepMeta.map((item, index) => {
              const active = index <= step;

              return (
                <View key={item.title} style={styles.stepRailItem}>
                  <View style={[styles.stepRailDot, active ? styles.stepRailDotActive : null]}>
                    <Text style={[styles.stepRailDotText, active ? styles.stepRailDotTextActive : null]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.stepRailText, index === step ? styles.stepRailTextActive : null]}>{item.title}</Text>
                </View>
              );
            })}
          </View>

          {step === 0 ? (
            <View style={styles.formBlock}>
              <View style={styles.avatarPreviewCard}>
                <ProfileAvatar avatarUri={form.avatarUri} nickname={form.nickname} presetId={form.avatarPresetId} size={86} />
                <View style={styles.avatarPreviewCopy}>
                  <Text style={styles.avatarPreviewTitle}>{form.nickname.trim() || "你的头像预览"}</Text>
                  <Text style={styles.avatarPreviewDescription}>设置一个容易识别的头像和昵称，后续记录会更自然。</Text>
                </View>
              </View>

              <View style={styles.avatarActionRow}>
                <OutlineButton
                  label={pickingAvatar ? "读取中..." : "从相册选择"}
                  onPress={() => void handlePickCustomAvatar()}
                  variant="primary"
                  disabled={pickingAvatar}
                />
                {form.avatarUri ? (
                  <OutlineButton
                    label="恢复预设头像"
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        avatarUri: null
                      }))
                    }
                    variant="secondary"
                  />
                ) : null}
              </View>

              <View style={styles.avatarGrid}>
                {avatarPresets.map((preset) => {
                  const selected = !form.avatarUri && form.avatarPresetId === preset.id;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={preset.id}
                      onPress={() => handleSelectPreset(preset.id)}
                      style={({ pressed }) => [
                        styles.avatarOption,
                        selected ? styles.avatarOptionSelected : null,
                        pressed ? styles.avatarOptionPressed : null
                      ]}
                    >
                      <ProfileAvatar nickname={form.nickname} presetId={preset.id} size={56} />
                      <View style={styles.avatarOptionLabelRow}>
                        <Text style={[styles.avatarOptionLabel, selected ? styles.avatarOptionLabelSelected : null]}>{preset.label}</Text>
                        {selected ? <Ionicons color={colors.primary} name="checkmark-circle" size={14} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <InputField
                label="昵称"
                onFocus={onFieldFocus}
                placeholder="例如：林岚"
                value={form.nickname}
                onChangeText={(value) => setForm((current) => ({ ...current, nickname: value }))}
              />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.formBlock}>
              <InputField
                label="健康状态"
                onFocus={onFieldFocus}
                placeholder="例如：2 型糖尿病"
                value={form.conditionLabel}
                onChangeText={(value) => setForm((current) => ({ ...current, conditionLabel: value }))}
              />
              <InputField
                label="当前目标"
                onFocus={onFieldFocus}
                placeholder="例如：降低餐后波动并稳定体重"
                value={form.primaryTarget}
                onChangeText={(value) => setForm((current) => ({ ...current, primaryTarget: value }))}
              />
              <InputField
                label="空腹血糖基线"
                onFocus={onFieldFocus}
                placeholder="例如：7.2 mmol/L"
                value={form.fastingGlucoseBaseline}
                onChangeText={(value) => setForm((current) => ({ ...current, fastingGlucoseBaseline: value }))}
              />
              <InputField
                label="血压基线"
                onFocus={onFieldFocus}
                placeholder="例如：128/82 mmHg"
                value={form.bloodPressureBaseline}
                onChangeText={(value) => setForm((current) => ({ ...current, bloodPressureBaseline: value }))}
              />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.formBlock}>
              <InputField
                label="当前用药"
                multiline
                onFocus={onFieldFocus}
                placeholder="例如：二甲双胍 0.5g bid"
                value={form.medicationPlan}
                onChangeText={(value) => setForm((current) => ({ ...current, medicationPlan: value }))}
              />
              <InputField
                label="照护重点"
                onFocus={onFieldFocus}
                placeholder="例如：晚饭后步行与睡前恢复流程"
                value={form.careFocus}
                onChangeText={(value) => setForm((current) => ({ ...current, careFocus: value }))}
              />
              <InputField
                label="备注摘要"
                multiline
                onFocus={onFieldFocus}
                placeholder="例如：对高 GI 主食敏感，午后久坐时波动更明显"
                value={form.notes}
                onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))}
              />
            </View>
          ) : null}

          <View style={styles.footerHintCard}>
            <Text style={styles.footerHintText}>日常记录可通过 AI 对话快速完成，资料页只保留少量核心信息维护。</Text>
          </View>

          <View style={styles.footerActions}>
            {step === 0 ? (
              <OutlineButton
                fullWidth
                label={mode === "initial" ? "稍后完善" : "关闭"}
                onPress={mode === "initial" ? () => void onSkip() : onCancel}
                variant="secondary"
              />
            ) : (
              <OutlineButton
                fullWidth
                label="上一步"
                onPress={() => setStep((current) => Math.max(0, current - 1))}
                variant="secondary"
              />
            )}

            {step < stepMeta.length - 1 ? (
              <OutlineButton
                fullWidth
                disabled={!canProceed}
                label="下一步"
                onPress={() => setStep((current) => current + 1)}
                variant="primary"
              />
            ) : (
              <OutlineButton
                fullWidth
                disabled={!canProceed || saving}
                label={saving ? "保存中..." : mode === "initial" ? "完成建档" : "保存资料"}
                onPress={() => void handleSubmit()}
                variant="primary"
              />
            )}
          </View>
          </View>
        </ScrollView>
      </KeyboardContainer>
    </SafeAreaView>
  );
}

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
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#F5F9FF",
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.lift
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  heroEyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "800"
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleSmall,
    lineHeight: 32,
    fontWeight: "800"
  },
  heroDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  progressSummaryRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  progressChip: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  progressChipLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  progressChipValue: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  stepCard: {
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card
  },
  stepTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  stepLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "800"
  },
  stepTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.bodyLarge,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  stepDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    marginTop: spacing.xs
  },
  stepFraction: {
    color: colors.textSoft,
    fontSize: typography.label,
    fontWeight: "700"
  },
  stepRail: {
    flexDirection: "row",
    gap: spacing.sm
  },
  stepRailItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs
  },
  stepRailDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center"
  },
  stepRailDotActive: {
    backgroundColor: colors.primary
  },
  stepRailDotText: {
    color: colors.textSoft,
    fontSize: typography.label,
    fontWeight: "700"
  },
  stepRailDotTextActive: {
    color: colors.inverseText
  },
  stepRailText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    textAlign: "center"
  },
  stepRailTextActive: {
    color: colors.text,
    fontWeight: "700"
  },
  formBlock: {
    gap: spacing.md
  },
  avatarPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    padding: spacing.md
  },
  avatarPreviewCopy: {
    flex: 1,
    gap: spacing.xs
  },
  avatarPreviewTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  avatarPreviewDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  avatarActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  avatarOption: {
    width: "31%",
    minWidth: 92,
    borderRadius: 18,
    backgroundColor: "#F9FAFC",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: spacing.sm
  },
  avatarOptionSelected: {
    backgroundColor: colors.primarySoft
  },
  avatarOptionPressed: {
    opacity: 0.88
  },
  avatarOptionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  avatarOptionLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  avatarOptionLabelSelected: {
    color: colors.primary
  },
  footerHintCard: {
    borderRadius: 18,
    backgroundColor: "#F9FAFC",
    padding: spacing.md
  },
  footerHintText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  footerActions: {
    flexDirection: "row",
    gap: spacing.md
  }
});
