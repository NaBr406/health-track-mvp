import type { TextInputProps } from "react-native";
import { StyleSheet, View } from "react-native";
import { InputField } from "../../../components/clinical";
import { spacing } from "../../../theme/tokens";
import type { WizardForm } from "../model/onboardingWizardModel";

type OnboardingCareStepProps = {
  form: WizardForm;
  onFieldFocus?: TextInputProps["onFocus"];
  onMedicationPlanChange: (value: string) => void;
  onCareFocusChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export function OnboardingCareStep({
  form,
  onFieldFocus,
  onMedicationPlanChange,
  onCareFocusChange,
  onNotesChange
}: OnboardingCareStepProps) {
  return (
    <View style={styles.formBlock}>
      <InputField label="当前用药" multiline onFocus={onFieldFocus} placeholder="例如：二甲双胍 0.5g bid" value={form.medicationPlan} onChangeText={onMedicationPlanChange} />
      <InputField label="照护重点" onFocus={onFieldFocus} placeholder="例如：晚饭后步行与睡前恢复流程" value={form.careFocus} onChangeText={onCareFocusChange} />
      <InputField label="备注摘要" multiline onFocus={onFieldFocus} placeholder="例如：对高 GI 主食敏感，午后久坐时波动更明显" value={form.notes} onChangeText={onNotesChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  formBlock: {
    gap: spacing.md
  }
});
