import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, MetricCard, SectionCard, SectionTitle, TextField } from "../../components/ui";
import { api } from "../../lib/api";
import { mockDashboardSummary, mockProfile } from "../../lib/mock";
import { formatShortDate, getTodayString, safeNumber } from "../../lib/utils";
import type { DashboardSummary, Profile } from "../../types";

type ProfileForm = {
  nickname: string;
  dailyCalorieGoal: string;
  weeklyExerciseGoalMinutes: string;
  careFocus: string;
  healthGoal: string;
};

function toForm(profile: Profile): ProfileForm {
  return {
    nickname: profile.nickname ?? "",
    dailyCalorieGoal: profile.dailyCalorieGoal?.toString() ?? "",
    weeklyExerciseGoalMinutes: profile.weeklyExerciseGoalMinutes?.toString() ?? "",
    careFocus: profile.careFocus ?? "",
    healthGoal: profile.healthGoal ?? ""
  };
}

export function DashboardScreen() {
  const [focusDate, setFocusDate] = useState(getTodayString());
  const [summary, setSummary] = useState<DashboardSummary>(mockDashboardSummary);
  const [form, setForm] = useState<ProfileForm>(toForm(mockProfile));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void loadData(true);
  }, [focusDate]);

  async function loadData(initialLoad = false) {
    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const [summaryResult, profileResult] = await Promise.all([
      api.getDashboardSummary(focusDate),
      api.getProfile()
    ]);

    setSummary(summaryResult);
    setForm(toForm(profileResult));
    setLoading(false);
    setRefreshing(false);
  }

  async function handleSave() {
    setSaving(true);
    setNotice("");

    const updated = await api.updateProfile({
      nickname: form.nickname,
      dailyCalorieGoal: safeNumber(form.dailyCalorieGoal),
      weeklyExerciseGoalMinutes: safeNumber(form.weeklyExerciseGoalMinutes),
      careFocus: form.careFocus,
      healthGoal: form.healthGoal
    });

    setForm(toForm(updated));
    setSaving(false);
    setNotice("个人目标已保存");
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData()} />}
      showsVerticalScrollIndicator={false}
    >
      <SectionCard>
        <SectionTitle>焦点日期</SectionTitle>
        <Text style={styles.paragraph}>输入 `YYYY-MM-DD` 可以切换统计日期。</Text>
        <TextField
          label="统计日期"
          value={focusDate}
          onChangeText={setFocusDate}
          autoCapitalize="none"
          hint={loading ? "正在加载数据..." : "下拉可重新刷新"}
        />
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </SectionCard>

      <View style={styles.metricsRow}>
        <MetricCard
          label="今日热量"
          value={`${summary.totalCalories} kcal`}
          helper={`目标 ${summary.dailyCalorieGoal} kcal`}
        />
        <MetricCard
          label="今日运动"
          value={`${summary.totalExerciseMinutes} min`}
          helper={`本周目标 ${summary.weeklyExerciseGoalMinutes} min`}
        />
      </View>

      <View style={styles.metricsRow}>
        <MetricCard
          label="护理时长"
          value={`${summary.totalCareMinutes} min`}
          helper={`${summary.careCount} 条记录`}
        />
        <MetricCard
          label="目标完成率"
          value={`${summary.goalCompletionRate}%`}
          helper="基于饮食与运动的简化估算"
        />
      </View>

      <SectionCard>
        <SectionTitle>今日摘要</SectionTitle>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>饮食</Text>
            <Text style={styles.summaryValue}>{summary.dietCount}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>运动</Text>
            <Text style={styles.summaryValue}>{summary.exerciseCount}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>护理</Text>
            <Text style={styles.summaryValue}>{summary.careCount}</Text>
          </View>
        </View>

        <View style={styles.adviceBox}>
          <Text style={styles.adviceTitle}>AI 摘要</Text>
          <Text style={styles.paragraph}>{summary.latestAdvice}</Text>
        </View>
      </SectionCard>

      <SectionCard>
        <SectionTitle>近 7 天趋势</SectionTitle>
        {summary.weeklyActivity.map((item) => (
          <View key={item.date} style={styles.dayRow}>
            <Text style={styles.dayDate}>{formatShortDate(item.date)}</Text>
            <Text style={styles.dayValue}>{item.calories} kcal</Text>
            <Text style={styles.dayValue}>{item.exerciseMinutes} min</Text>
            <Text style={styles.dayValue}>{item.careMinutes} min</Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard>
        <SectionTitle>个人目标</SectionTitle>
        <TextField
          label="昵称"
          value={form.nickname}
          onChangeText={(value) => setForm((current) => ({ ...current, nickname: value }))}
        />
        <TextField
          label="每日热量目标"
          value={form.dailyCalorieGoal}
          onChangeText={(value) => setForm((current) => ({ ...current, dailyCalorieGoal: value }))}
          keyboardType="number-pad"
        />
        <TextField
          label="每周运动目标（分钟）"
          value={form.weeklyExerciseGoalMinutes}
          onChangeText={(value) =>
            setForm((current) => ({ ...current, weeklyExerciseGoalMinutes: value }))
          }
          keyboardType="number-pad"
        />
        <TextField
          label="护理关注点"
          value={form.careFocus}
          onChangeText={(value) => setForm((current) => ({ ...current, careFocus: value }))}
        />
        <TextField
          label="健康目标"
          value={form.healthGoal}
          onChangeText={(value) => setForm((current) => ({ ...current, healthGoal: value }))}
          multiline
        />
        <Button
          label={saving ? "保存中..." : "保存目标"}
          onPress={() => {
            void handleSave();
          }}
          disabled={saving}
        />
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    paddingBottom: 12,
    gap: 14
  },
  paragraph: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 22
  },
  notice: {
    color: "#6ee7b7",
    fontSize: 13,
    fontWeight: "700"
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12
  },
  summaryCell: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    gap: 6
  },
  summaryLabel: {
    color: "#94a3b8",
    fontSize: 12
  },
  summaryValue: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "700"
  },
  adviceBox: {
    borderRadius: 20,
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.18)",
    padding: 16,
    gap: 8
  },
  adviceTitle: {
    color: "#6ee7b7",
    fontSize: 14,
    fontWeight: "700"
  },
  dayRow: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  dayDate: {
    width: 56,
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700"
  },
  dayValue: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 13
  }
});
