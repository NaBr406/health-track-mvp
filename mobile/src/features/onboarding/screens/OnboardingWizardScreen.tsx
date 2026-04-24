/**
 * 多步骤引导页，用于完善或编辑健康档案。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingAvatarStep } from "../components/OnboardingAvatarStep";
import { OnboardingBaselineStep } from "../components/OnboardingBaselineStep";
import { OnboardingCareStep } from "../components/OnboardingCareStep";
import { OnboardingFooterActions } from "../components/OnboardingFooterActions";
import { OnboardingHeroCard } from "../components/OnboardingHeroCard";
import { OnboardingStepShell } from "../components/OnboardingStepShell";
import {
  buildOnboardingProfileDraft,
  canProceedOnboardingStep,
  createOnboardingForm,
  onboardingStepMeta,
  type OnboardingWizardScreenProps,
  type WizardTextField
} from "../model/onboardingWizardModel";
import { profileApi } from "../../profile/api/profileApi";
import { useScrollFocusedInputIntoView } from "../../../lib/useScrollFocusedInputIntoView";
import { colors, layout, spacing } from "../../../theme/tokens";

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
  const [form, setForm] = useState(() => createOnboardingForm(initialProfile));
  const [saving, setSaving] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  useEffect(() => {
    setForm(createOnboardingForm(initialProfile));
    setStep(0);
  }, [initialProfile]);

  const canProceed = useMemo(() => canProceedOnboardingStep(step, form), [form, step]);
  const headerTitle = mode === "initial" ? "完善你的健康档案" : "编辑健康档案";
  const headerDescription =
    mode === "initial" ? "3 步完成基础建档，支持稍后继续完善。" : "更新头像、基线和照护重点。";

  function updateFormField(field: WizardTextField, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateAvatarUri(value: string | null) {
    setForm((current) => ({
      ...current,
      avatarUri: value
    }));
  }

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
      updateAvatarUri(asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri);
    } catch {
      Alert.alert("头像更新失败", "这次没有成功读取图片，请稍后再试。");
    } finally {
      setPickingAvatar(false);
    }
  }

  function handleSelectPreset(presetId: string) {
    updateFormField("avatarPresetId", presetId);
    updateAvatarUri(null);
  }

  async function handleSubmit() {
    if (!canProceed) {
      return;
    }

    setSaving(true);

    try {
      const profile = await profileApi.saveHealthProfile(buildOnboardingProfileDraft(initialProfile, form));
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
          <OnboardingHeroCard
            description={headerDescription}
            mode={mode}
            onDismiss={mode === "initial" ? () => void onSkip() : onCancel}
            step={step}
            title={headerTitle}
            totalSteps={onboardingStepMeta.length}
          />

          <OnboardingStepShell step={step}>
            {step === 0 ? (
              <OnboardingAvatarStep
                form={form}
                onFieldFocus={onFieldFocus}
                onNicknameChange={(value) => updateFormField("nickname", value)}
                onPickCustomAvatar={() => void handlePickCustomAvatar()}
                onResetAvatar={() => updateAvatarUri(null)}
                onSelectPreset={handleSelectPreset}
                pickingAvatar={pickingAvatar}
              />
            ) : null}

            {step === 1 ? (
              <OnboardingBaselineStep
                form={form}
                onBloodPressureBaselineChange={(value) => updateFormField("bloodPressureBaseline", value)}
                onConditionLabelChange={(value) => updateFormField("conditionLabel", value)}
                onFastingGlucoseBaselineChange={(value) => updateFormField("fastingGlucoseBaseline", value)}
                onFieldFocus={onFieldFocus}
                onPrimaryTargetChange={(value) => updateFormField("primaryTarget", value)}
              />
            ) : null}

            {step === 2 ? (
              <OnboardingCareStep
                form={form}
                onCareFocusChange={(value) => updateFormField("careFocus", value)}
                onFieldFocus={onFieldFocus}
                onMedicationPlanChange={(value) => updateFormField("medicationPlan", value)}
                onNotesChange={(value) => updateFormField("notes", value)}
              />
            ) : null}

            <OnboardingFooterActions
              canProceed={canProceed}
              mode={mode}
              onDismiss={mode === "initial" ? () => void onSkip() : onCancel}
              onNext={() => setStep((current) => current + 1)}
              onPrevious={() => setStep((current) => Math.max(0, current - 1))}
              onSubmit={() => void handleSubmit()}
              saving={saving}
              step={step}
              totalSteps={onboardingStepMeta.length}
            />
          </OnboardingStepShell>
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
  }
});
