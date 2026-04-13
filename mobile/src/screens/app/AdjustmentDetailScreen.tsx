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

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
          >
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>方案详情</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Panel style={styles.heroPanel}>
          <SectionHeader
            eyebrow={formatDisplayDate(snapshot.focusDate)}
            title={snapshot.adjustment.title}
            description={snapshot.headline}
          />
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
          <SectionHeader eyebrow="简要建议" title="今天执行重点" />
          <Text style={styles.summaryText}>{snapshot.adjustment.summary}</Text>
        </Panel>

        <Panel>
          <SectionHeader eyebrow="详细说明" title="AI 推演依据" />
          <Text style={styles.bodyText}>{snapshot.adjustment.rationale}</Text>
        </Panel>

        <Panel>
          <SectionHeader eyebrow="系统观察" title="今天提醒" />
          <Text style={styles.bodyText}>{snapshot.observation}</Text>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="参考指标"
            title="今日监测摘要"
            description="以下指标用于辅助理解这次建议。"
          />
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  backButtonPressed: {
    opacity: 0.9
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  headerSpacer: {
    width: 44
  },
  heroPanel: {
    backgroundColor: colors.surfaceWarm
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  metricCard: {
    flex: 1,
    minWidth: 148,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  metricLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  metricValue: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  },
  summaryText: {
    color: colors.text,
    fontSize: typography.titleSmall,
    lineHeight: 36,
    fontWeight: "700"
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: typography.bodyLarge,
    lineHeight: 30
  },
  supportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  supportCard: {
    width: "48%",
    minWidth: 150,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs
  },
  supportLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  supportDescriptor: {
    color: colors.text,
    fontSize: typography.body
  }
});
