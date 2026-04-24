import type { TextInputProps } from "react-native";
import { StyleSheet, View } from "react-native";
import { InputField } from "../../../components/clinical";
import { spacing } from "../../../theme/tokens";
import type { WizardForm } from "../model/onboardingWizardModel";

type OnboardingBaselineStepProps = {
  form: WizardForm;
  onFieldFocus?: TextInputProps["onFocus"];
  onConditionLabelChange: (value: string) => void;
  onPrimaryTargetChange: (value: string) => void;
  onFastingGlucoseBaselineChange: (value: string) => void;
  onBloodPressureBaselineChange: (value: string) => void;
};

export function OnboardingBaselineStep({
  form,
  onFieldFocus,
  onConditionLabelChange,
  onPrimaryTargetChange,
  onFastingGlucoseBaselineChange,
  onBloodPressureBaselineChange
}: OnboardingBaselineStepProps) {
  return (
    <View style={styles.formBlock}>
      <InputField label="健康状态" onFocus={onFieldFocus} placeholder="例如：2 型糖尿病" value={form.conditionLabel} onChangeText={onConditionLabelChange} />
      <InputField label="当前目标" onFocus={onFieldFocus} placeholder="例如：降低餐后波动并稳定体重" value={form.primaryTarget} onChangeText={onPrimaryTargetChange} />
      <InputField label="空腹血糖基线" onFocus={onFieldFocus} placeholder="例如：7.2 mmol/L" value={form.fastingGlucoseBaseline} onChangeText={onFastingGlucoseBaselineChange} />
      <InputField label="血压基线" onFocus={onFieldFocus} placeholder="例如：128/82 mmHg" value={form.bloodPressureBaseline} onChangeText={onBloodPressureBaselineChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  formBlock: {
    gap: spacing.md
  }
});
