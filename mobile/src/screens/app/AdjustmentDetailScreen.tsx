/**
 * 当前 AI 调整建议的详情页，用来展开解释预测依据和调整原因。
 */
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MonoValue, Panel, SectionHeader } from "../../components/clinical";
import { formatDateTime, formatDisplayDate } from "../../lib/utils";
import type { DashboardStackParamList } from "../../navigation/MainTabsNavigator";
import { borders, colors, layout, radii, spacing, typography } from "../../theme/tokens";

type AdjustmentDetailScreenProps = NativeStackScreenProps<DashboardStackParamList, "AdjustmentDetail">;

export function AdjustmentDetailScreen({ navigation, route }: AdjustmentDetailScreenProps) {
  const { snapshot } = route.params;
  const forecastCards = buildForecastCards(snapshot);
  const forecastDescription = buildForecastDescription(snapshot);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}>
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>方案详情</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Panel>
          <SectionHeader eyebrow={formatDisplayDate(snapshot.focusDate)} title={snapshot.adjustment.title} description={snapshot.headline} />
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>调整参数</Text>
              <MonoValue value={snapshot.adjustment.parameterLabel} unit={snapshot.adjustment.parameterDelta} />
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>生成时间</Text>
              <Text style={styles.metricValue}>{formatDateTime(snapshot.adjustment.generatedAt)}</Text>
            </View>
          </View>
        </Panel>

        <Panel>
          <SectionHeader eyebrow="今日摘要" title="执行重点" />
          <Text style={styles.summaryText}>{snapshot.adjustment.summary}</Text>
        </Panel>

        {forecastCards.length > 0 ? (
          <Panel>
            <SectionHeader eyebrow="8 小时预测" title="血糖推演摘要" description={forecastDescription} />
            <View style={styles.supportGrid}>
              {forecastCards.map((item) => (
                <View key={item.label} style={styles.supportCard}>
                  <Text style={styles.supportLabel}>{item.label}</Text>
                  <MonoValue value={item.value} unit={item.unit} />
                  <Text style={styles.supportDescriptor}>{item.description}</Text>
                </View>
              ))}
            </View>
          </Panel>
        ) : null}

        <Panel>
          <SectionHeader eyebrow="推演依据" title="AI 分析说明" />
          <Text style={styles.bodyText}>{snapshot.adjustment.rationale}</Text>
        </Panel>

        <Panel>
          <SectionHeader eyebrow="系统观察" title="今日提醒" />
          <Text style={styles.bodyText}>{snapshot.observation}</Text>
        </Panel>

        <Panel>
          <SectionHeader eyebrow="参考指标" title="今日监测摘要" description="以下指标用于辅助理解这次建议的上下文。" />
          <View style={styles.supportGrid}>
            {snapshot.metrics.map((metric) => (
              <View key={metric.id} style={styles.supportCard}>
                <Text style={styles.supportLabel}>{metric.label}</Text>
                <MonoValue value={metric.value} unit={metric.unit} />
                <Text style={styles.supportDescriptor}>{metric.descriptor}</Text>
              </View>
            ))}
          </View>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildForecastCards(snapshot: AdjustmentDetailScreenProps["route"]["params"]["snapshot"]) {
  const cards: Array<{ label: string; value: string; unit?: string; description: string }> = [];
  const sourceLabel = resolveForecastSource(snapshot) === "dify" ? "Dify 工作流" : "本地规则模拟";

  if (snapshot.glucoseRiskLevel) {
    cards.push({ label: "风险等级", value: snapshot.glucoseRiskLevel, description: `${sourceLabel} 给出的当前 8 小时风险判断。` });
  }
  if (typeof snapshot.peakGlucoseMmol === "number") {
    cards.push({
      label: "预测峰值",
      value: snapshot.peakGlucoseMmol.toFixed(1),
      unit: "mmol/L",
      description: typeof snapshot.peakHourOffset === "number" ? `预计在 +${snapshot.peakHourOffset}h 左右出现峰值。` : "预计未来 8 小时内的最高值。"
    });
  }
  if (typeof snapshot.returnToBaselineHourOffset === "number") {
    cards.push({
      label: "回基线时间",
      value: `+${snapshot.returnToBaselineHourOffset}`,
      unit: "h",
      description: "模型预计回落到个人基线附近的大致时间。"
    });
  }
  if (typeof snapshot.calibrationApplied === "boolean") {
    cards.push({
      label: "本次校准",
      value: snapshot.calibrationApplied ? "已校准" : "未校准",
      description: snapshot.calibrationApplied ? "已结合用户最新实测血糖重新估算后续曲线。" : "当前曲线仍基于食物和行为推断。"
    });
  }

  return cards;
}

function buildForecastDescription(snapshot: AdjustmentDetailScreenProps["route"]["params"]["snapshot"]) {
  const sourceLabel = resolveForecastSource(snapshot) === "dify" ? "Dify 工作流输出" : "本地规则模拟";
  return `以下信息来自${sourceLabel}，可被新的实测血糖再次校准。`;
}

function resolveForecastSource(snapshot: AdjustmentDetailScreenProps["route"]["params"]["snapshot"]) {
  if (snapshot.forecastSource === "dify") {
    return "dify";
  }
  return "local";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.pageHorizontal, paddingTop: layout.pageTop, paddingBottom: layout.pageBottom, gap: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 44, height: 44, borderRadius: radii.pill, borderWidth: borders.standard, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  backButtonPressed: { opacity: 0.9 },
  headerTitle: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: "700" },
  headerSpacer: { width: 44 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricCard: { flex: 1, minWidth: 148, borderRadius: radii.md, borderWidth: borders.standard, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.xs },
  metricLabel: { color: colors.textSoft, fontSize: typography.caption, fontWeight: "600" },
  metricValue: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: "700" },
  summaryText: { color: colors.text, fontSize: typography.titleSmall, lineHeight: 36, fontWeight: "700" },
  bodyText: { color: colors.textMuted, fontSize: typography.bodyLarge, lineHeight: 30 },
  supportGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  supportCard: { width: "48%", minWidth: 150, borderRadius: radii.md, borderWidth: borders.standard, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.xs },
  supportLabel: { color: colors.textSoft, fontSize: typography.caption, fontWeight: "600" },
  supportDescriptor: { color: colors.textMuted, fontSize: typography.body, lineHeight: 22 }
});
