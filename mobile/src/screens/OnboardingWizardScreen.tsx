import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InputField, MonoValue, OutlineButton, Panel, SectionHeader } from "../components/clinical";
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

const stepLabels = ["疾病与目标", "关键指标", "用药与照护"];

function createForm(profile: HealthProfile | null): WizardForm {
  return {
    nickname: profile?.nickname ?? "",
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

  useEffect(() => {
    setForm(createForm(initialProfile));
    setStep(0);
  }, [initialProfile]);

  const stepMeta = useMemo(() => {
    switch (step) {
      case 0:
        return {
          title: "先建立疾病标签和阶段目标",
          description: "这一步只收集长期基线。完成后，饮食、运动、睡眠等每日行为都通过自然语言记录。"
        };
      case 1:
        return {
          title: "补齐关键生理指标",
          description: "输入会成为后续推演的基线，不再作为日常打卡表单重复出现。"
        };
      default:
        return {
          title: "收集用药与照护重点",
          description: "用药、护理关注点和补充备注会一起生成个人化基准方案。"
        };
    }
  }, [step]);

  const canProceed =
    step === 0
      ? Boolean(form.conditionLabel.trim() && form.primaryTarget.trim())
      : step === 1
        ? Boolean(form.weightKg.trim() && form.fastingGlucoseBaseline.trim())
        : Boolean(form.medicationPlan.trim() || form.careFocus.trim());

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
            eyebrow={mode === "initial" ? "首次建档" : "编辑健康档案"}
            title={mode === "initial" ? "先采集健康基线，再进入对话式管理" : "重建个人健康基线"}
            description="这里保留为唯一的结构化表单入口，只服务于首次建档和后续档案修订。"
            trailing={mode === "edit" ? <OutlineButton compact label="关闭" onPress={onCancel} variant="ghost" /> : undefined}
          />
          <View style={styles.promiseRow}>
            <View style={styles.promiseChip}>
              <Text style={styles.promiseChipLabel}>日常记录方式</Text>
              <Text style={styles.promiseChipValue}>自然语言描述</Text>
            </View>
            <View style={styles.promiseChip}>
              <Text style={styles.promiseChipLabel}>建档后</Text>
              <Text style={styles.promiseChipValue}>不再保留打卡表单</Text>
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
              <InputField
                label="称呼"
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
                <InputField
                  keyboardType="number-pad"
                  label="年龄"
                  value={form.age}
                  onChangeText={(value) => setForm((current) => ({ ...current, age: value }))}
                />
                <InputField
                  label="生理性别"
                  value={form.biologicalSex}
                  onChangeText={(value) => setForm((current) => ({ ...current, biologicalSex: value }))}
                />
              </View>
              <View style={styles.doubleRow}>
                <InputField
                  keyboardType="decimal-pad"
                  label="身高 cm"
                  value={form.heightCm}
                  onChangeText={(value) => setForm((current) => ({ ...current, heightCm: value }))}
                />
                <InputField
                  keyboardType="decimal-pad"
                  label="当前体重 kg"
                  value={form.weightKg}
                  onChangeText={(value) => setForm((current) => ({ ...current, weightKg: value }))}
                />
              </View>
              <View style={styles.doubleRow}>
                <InputField
                  keyboardType="decimal-pad"
                  label="目标体重 kg"
                  value={form.targetWeightKg}
                  onChangeText={(value) => setForm((current) => ({ ...current, targetWeightKg: value }))}
                />
                <InputField
                  keyboardType="number-pad"
                  label="静息心率"
                  value={form.restingHeartRate}
                  onChangeText={(value) => setForm((current) => ({ ...current, restingHeartRate: value }))}
                />
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
                placeholder="例如：晚餐后步行与睡前恢复流程"
                value={form.careFocus}
                onChangeText={(value) => setForm((current) => ({ ...current, careFocus: value }))}
              />
              <InputField
                label="补充备注"
                multiline
                placeholder="例如：对高 GI 主食敏感，午后久坐时波动明显"
                value={form.notes}
                onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))}
              />
            </>
          ) : null}

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>保存后会生成个人基准方案，之后每天只需要描述行为和症状变化。</Text>
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
                label={saving ? "正在生成方案..." : "完成建档"}
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
  doubleRow: {
    flexDirection: "row",
    gap: spacing.md
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
