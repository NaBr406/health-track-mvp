import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InputField, MonoValue, OutlineButton, Panel, SectionHeader } from "../components/clinical";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { avatarPresets } from "../lib/avatarPresets";
import { api } from "../lib/api";
import { safeNumber, safeText } from "../lib/utils";
import { borders, colors, fonts, layout, radii, spacing, typography } from "../theme/tokens";
import type { HealthProfile } from "../types";

type OnboardingWizardScreenProps = {
  mode: "initial" | "edit";
  initialProfile: HealthProfile | null;
  onCancel: () => void;
  onComplete: (profile: HealthProfile) => Promise<void>;
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

const stepLabels = ["头像与目标", "关键指标", "用药与照护"];

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
  onComplete
}: OnboardingWizardScreenProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(() => createForm(initialProfile));
  const [saving, setSaving] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  useEffect(() => {
    setForm(createForm(initialProfile));
    setStep(0);
  }, [initialProfile]);

  const stepMeta = useMemo(() => {
    switch (step) {
      case 0:
        return {
          title: "先设置头像、昵称和当前目标",
          description: "这里是唯一保留的结构化编辑入口，用来完善你的基础档案。之后每天的饮食、运动、睡眠与状态变化，都通过 AI 对话记录。"
        };
      case 1:
        return {
          title: "补齐关键生理指标",
          description: "这些数据只作为长期基线，让首页建议和 AI 解读更贴近你的真实情况。"
        };
      default:
        return {
          title: "完善用药与照护重点",
          description: "保存后会更新你的基准方案，首页与 AI 对话页都会按这份档案继续服务。"
        };
    }
  }, [step]);

  const canProceed =
    step === 0
      ? Boolean(form.nickname.trim() && form.conditionLabel.trim() && form.primaryTarget.trim())
      : step === 1
        ? Boolean(form.weightKg.trim() && form.fastingGlucoseBaseline.trim())
        : true;

  async function handlePickCustomAvatar() {
    setPickingAvatar(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("无法访问相册", "请先允许应用访问相册，这样才能选择自定义头像。");
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
      const customAvatarUri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;

      setForm((current) => ({
        ...current,
        avatarUri: customAvatarUri
      }));
    } catch {
      Alert.alert("头像更新失败", "这次没有成功读取图片，请稍后再试一次。");
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

  function handleClearCustomAvatar() {
    setForm((current) => ({
      ...current,
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
      const profile = await api.saveHealthProfile({
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Panel style={styles.heroCard}>
          <SectionHeader
            eyebrow={mode === "initial" ? "首次建档" : "编辑个人资料"}
            title={mode === "initial" ? "先完成健康基线，再进入对话式管理" : "更新头像、昵称与健康基线"}
            description="这里保留为唯一的结构化编辑入口。日常行为日志仍然统一通过 AI 对话完成。"
            trailing={mode === "edit" ? <OutlineButton compact label="关闭" onPress={onCancel} variant="ghost" /> : undefined}
          />

          <View style={styles.promiseRow}>
            <View style={styles.promiseChip}>
              <Text style={styles.promiseChipLabel}>日常录入方式</Text>
              <Text style={styles.promiseChipValue}>只通过 AI 对话</Text>
            </View>
            <View style={styles.promiseChip}>
              <Text style={styles.promiseChipLabel}>本页可编辑</Text>
              <Text style={styles.promiseChipValue}>头像 昵称 基础信息</Text>
            </View>
          </View>
        </Panel>

        <Panel>
          <View style={styles.progressTop}>
            <View style={styles.progressCopy}>
              <Text style={styles.progressLabel}>步骤 {step + 1}</Text>
              <Text style={styles.progressTitle}>{stepLabels[step]}</Text>
              <Text style={styles.progressDescription}>{stepMeta.description}</Text>
            </View>
            <MonoValue value={`0${step + 1}`} unit="/03" />
          </View>

          <View style={styles.progressRail}>
            {stepLabels.map((label, index) => (
              <View key={label} style={styles.progressItem}>
                <View style={[styles.progressDot, index <= step ? styles.progressDotActive : null]}>
                  <Text style={[styles.progressDotLabel, index <= step ? styles.progressDotLabelActive : null]}>{index + 1}</Text>
                </View>
                <Text style={[styles.progressItemLabel, index === step ? styles.progressItemLabelActive : null]}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.stepSummary}>
            <Text style={styles.stepSummaryTitle}>{stepMeta.title}</Text>
          </View>

          {step === 0 ? (
            <>
              <View style={styles.avatarPreviewCard}>
                <ProfileAvatar avatarUri={form.avatarUri} nickname={form.nickname} presetId={form.avatarPresetId} size={88} />
                <View style={styles.avatarPreviewCopy}>
                  <View style={styles.avatarStatusRow}>
                    <View style={[styles.avatarStatusChip, form.avatarUri ? styles.avatarStatusChipCustom : styles.avatarStatusChipPreset]}>
                      <Ionicons
                        color={form.avatarUri ? colors.primary : colors.warning}
                        name={form.avatarUri ? "image-outline" : "sparkles-outline"}
                        size={14}
                      />
                      <Text style={[styles.avatarStatusLabel, form.avatarUri ? styles.avatarStatusLabelCustom : styles.avatarStatusLabelPreset]}>
                        {form.avatarUri ? "自定义头像" : "预设头像"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.avatarPreviewName}>{form.nickname.trim() || "你的头像预览"}</Text>
                  <Text style={styles.avatarPreviewHint}>
                    {form.avatarUri ? "已从相册选择头像，你随时可以恢复为预设头像。" : "可以先选一个预设，也可以直接从相册选择自己的照片。"}
                  </Text>
                </View>
              </View>

              <View style={styles.avatarActionRow}>
                <OutlineButton
                  label={pickingAvatar ? "读取相册中..." : "从相册选择"}
                  onPress={() => void handlePickCustomAvatar()}
                  variant="primary"
                  disabled={pickingAvatar}
                />
                {form.avatarUri ? <OutlineButton label="恢复预设头像" onPress={handleClearCustomAvatar} variant="secondary" /> : null}
              </View>

              <Text style={styles.helperText}>支持裁剪为方形头像，保存后会直接同步到当前设备上的个人资料页。</Text>

              <View style={styles.avatarGrid}>
                {avatarPresets.map((preset) => {
                  const selected = !form.avatarUri && form.avatarPresetId === preset.id;

                  return (
                    <Pressable
                      key={preset.id}
                      accessibilityRole="button"
                      onPress={() => handleSelectPreset(preset.id)}
                      style={({ pressed }) => [
                        styles.avatarOption,
                        selected ? styles.avatarOptionSelected : null,
                        form.avatarUri ? styles.avatarOptionDimmed : null,
                        pressed ? styles.avatarOptionPressed : null
                      ]}
                    >
                      <ProfileAvatar nickname={form.nickname} presetId={preset.id} size={60} />
                      <View style={styles.avatarOptionLabelRow}>
                        <Text style={[styles.avatarOptionLabel, selected ? styles.avatarOptionLabelSelected : null]}>{preset.label}</Text>
                        {selected ? <Ionicons color={colors.primary} name="checkmark-circle" size={16} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <InputField
                label="昵称"
                placeholder="例如：林岚"
                value={form.nickname}
                onChangeText={(value) => setForm((current) => ({ ...current, nickname: value }))}
              />
              <InputField
                label="疾病标签"
                placeholder="例如：2 型糖尿病"
                value={form.conditionLabel}
                onChangeText={(value) => setForm((current) => ({ ...current, conditionLabel: value }))}
              />
              <InputField
                label="当前阶段目标"
                placeholder="例如：降低餐后波动并稳定体重"
                value={form.primaryTarget}
                onChangeText={(value) => setForm((current) => ({ ...current, primaryTarget: value }))}
              />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <View style={styles.doubleRow}>
                <View style={styles.flexField}>
                  <InputField
                    keyboardType="number-pad"
                    label="年龄"
                    value={form.age}
                    onChangeText={(value) => setForm((current) => ({ ...current, age: value }))}
                  />
                </View>
                <View style={styles.flexField}>
                  <InputField
                    label="生理性别"
                    value={form.biologicalSex}
                    onChangeText={(value) => setForm((current) => ({ ...current, biologicalSex: value }))}
                  />
                </View>
              </View>
              <View style={styles.doubleRow}>
                <View style={styles.flexField}>
                  <InputField
                    keyboardType="decimal-pad"
                    label="身高 cm"
                    value={form.heightCm}
                    onChangeText={(value) => setForm((current) => ({ ...current, heightCm: value }))}
                  />
                </View>
                <View style={styles.flexField}>
                  <InputField
                    keyboardType="decimal-pad"
                    label="当前体重 kg"
                    value={form.weightKg}
                    onChangeText={(value) => setForm((current) => ({ ...current, weightKg: value }))}
                  />
                </View>
              </View>
              <View style={styles.doubleRow}>
                <View style={styles.flexField}>
                  <InputField
                    keyboardType="decimal-pad"
                    label="目标体重 kg"
                    value={form.targetWeightKg}
                    onChangeText={(value) => setForm((current) => ({ ...current, targetWeightKg: value }))}
                  />
                </View>
                <View style={styles.flexField}>
                  <InputField
                    keyboardType="number-pad"
                    label="静息心率"
                    value={form.restingHeartRate}
                    onChangeText={(value) => setForm((current) => ({ ...current, restingHeartRate: value }))}
                  />
                </View>
              </View>
              <InputField
                label="空腹血糖基线"
                placeholder="例如：7.2 mmol/L"
                value={form.fastingGlucoseBaseline}
                onChangeText={(value) => setForm((current) => ({ ...current, fastingGlucoseBaseline: value }))}
              />
              <InputField
                label="血压基线"
                placeholder="例如：128/82 mmHg"
                value={form.bloodPressureBaseline}
                onChangeText={(value) => setForm((current) => ({ ...current, bloodPressureBaseline: value }))}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <InputField
                label="当前用药"
                multiline
                placeholder="例如：二甲双胍 0.5g bid"
                value={form.medicationPlan}
                onChangeText={(value) => setForm((current) => ({ ...current, medicationPlan: value }))}
              />
              <InputField
                label="照护重点"
                placeholder="例如：晚饭后步行与睡前恢复流程"
                value={form.careFocus}
                onChangeText={(value) => setForm((current) => ({ ...current, careFocus: value }))}
              />
              <InputField
                label="补充备注"
                multiline
                placeholder="例如：对高 GI 主食敏感，午后久坐时波动更明显"
                value={form.notes}
                onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))}
              />
            </>
          ) : null}

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>保存后会更新你的个人基线方案。后续每天只需要通过 AI 对话描述行为、症状和感受，不再使用日常表单录入。</Text>
          </View>

          <View style={styles.footerActions}>
            <OutlineButton
              disabled={step === 0}
              fullWidth
              label="上一步"
              onPress={() => setStep((current) => Math.max(0, current - 1))}
              variant="secondary"
            />
            {step < stepLabels.length - 1 ? (
              <OutlineButton
                disabled={!canProceed}
                fullWidth
                label="下一步"
                onPress={() => setStep((current) => current + 1)}
                variant="primary"
              />
            ) : (
              <OutlineButton
                disabled={!canProceed || saving}
                fullWidth
                label={saving ? "保存中..." : mode === "initial" ? "完成建档" : "保存资料"}
                onPress={() => void handleSubmit()}
                variant="primary"
              />
            )}
          </View>
        </Panel>
      </ScrollView>
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
    backgroundColor: colors.surfaceTint
  },
  promiseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  promiseChip: {
    flex: 1,
    minWidth: 140,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  promiseChipLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  promiseChipValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  progressCopy: {
    flex: 1,
    gap: spacing.xs
  },
  progressLabel: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: "700"
  },
  progressTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: typography.titleMedium,
    lineHeight: 38,
    fontWeight: "700"
  },
  progressDescription: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  progressRail: {
    flexDirection: "row",
    gap: spacing.sm
  },
  progressItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs
  },
  progressDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: borders.standard,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  progressDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  progressDotLabel: {
    color: colors.textSoft,
    fontSize: typography.label,
    fontWeight: "700"
  },
  progressDotLabelActive: {
    color: colors.inverseText
  },
  progressItemLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    textAlign: "center"
  },
  progressItemLabelActive: {
    color: colors.text,
    fontWeight: "700"
  },
  stepSummary: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  stepSummaryTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    lineHeight: 26,
    fontWeight: "700"
  },
  avatarPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md
  },
  avatarPreviewCopy: {
    flex: 1,
    gap: spacing.xs
  },
  avatarStatusRow: {
    flexDirection: "row"
  },
  avatarStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  avatarStatusChipCustom: {
    backgroundColor: colors.primarySoft
  },
  avatarStatusChipPreset: {
    backgroundColor: colors.warningSoft
  },
  avatarStatusLabel: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  avatarStatusLabelCustom: {
    color: colors.primary
  },
  avatarStatusLabelPreset: {
    color: colors.warning
  },
  avatarPreviewName: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "800"
  },
  avatarPreviewHint: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22
  },
  avatarActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  helperText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 20
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  avatarOption: {
    width: "31%",
    minWidth: 96,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: spacing.sm
  },
  avatarOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  avatarOptionDimmed: {
    opacity: 0.55
  },
  avatarOptionPressed: {
    opacity: 0.92
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
  doubleRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  flexField: {
    flex: 1
  },
  footerNote: {
    borderRadius: radii.md,
    backgroundColor: colors.backgroundAccent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  footerNoteText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24
  },
  footerActions: {
    flexDirection: "row",
    gap: spacing.md
  }
});
