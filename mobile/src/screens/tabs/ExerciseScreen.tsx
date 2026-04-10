import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, EmptyState, SectionCard, SectionTitle, TextField } from "../../components/ui";
import { api } from "../../lib/api";
import { getTodayString } from "../../lib/utils";
import type { ExerciseRecord } from "../../types";

type ExerciseForm = {
  recordedOn: string;
  activityName: string;
  durationMinutes: string;
  intensity: string;
  note: string;
};

const initialForm: ExerciseForm = {
  recordedOn: getTodayString(),
  activityName: "",
  durationMinutes: "",
  intensity: "中等",
  note: ""
};

export function ExerciseScreen() {
  const [focusDate, setFocusDate] = useState(getTodayString());
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [form, setForm] = useState<ExerciseForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadRecords();
  }, [focusDate]);

  async function loadRecords() {
    setLoading(true);
    const nextRecords = await api.getExerciseRecords(focusDate);
    setRecords(nextRecords);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.activityName || !form.durationMinutes) {
      return;
    }

    setSaving(true);
    const created = await api.createExerciseRecord({
      recordedOn: form.recordedOn,
      activityName: form.activityName,
      durationMinutes: Number(form.durationMinutes),
      intensity: form.intensity,
      note: form.note
    });

    if (created.recordedOn === focusDate) {
      setRecords((current) => [created, ...current]);
    }

    setForm({
      ...initialForm,
      recordedOn: form.recordedOn,
      intensity: form.intensity
    });
    setSaving(false);
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionCard>
        <SectionTitle>查询日期</SectionTitle>
        <Text style={styles.tip}>输入 `YYYY-MM-DD` 查看当天运动记录。</Text>
        <TextField label="日期" value={focusDate} onChangeText={setFocusDate} autoCapitalize="none" />
      </SectionCard>

      <SectionCard>
        <SectionTitle>新增运动</SectionTitle>
        <TextField
          label="记录日期"
          value={form.recordedOn}
          onChangeText={(value) => setForm((current) => ({ ...current, recordedOn: value }))}
        />
        <TextField
          label="运动名称"
          value={form.activityName}
          onChangeText={(value) => setForm((current) => ({ ...current, activityName: value }))}
        />
        <TextField
          label="时长（分钟）"
          value={form.durationMinutes}
          onChangeText={(value) => setForm((current) => ({ ...current, durationMinutes: value }))}
          keyboardType="number-pad"
        />
        <TextField
          label="强度"
          value={form.intensity}
          onChangeText={(value) => setForm((current) => ({ ...current, intensity: value }))}
        />
        <TextField
          label="备注"
          value={form.note}
          onChangeText={(value) => setForm((current) => ({ ...current, note: value }))}
          multiline
        />
        <Button
          label={saving ? "保存中..." : "保存运动记录"}
          onPress={() => {
            void handleCreate();
          }}
          disabled={saving}
        />
      </SectionCard>

      <SectionCard>
        <SectionTitle>记录列表</SectionTitle>
        {loading ? <Text style={styles.tip}>加载中...</Text> : null}
        {!loading && records.length === 0 ? <EmptyState>当天还没有运动记录。</EmptyState> : null}
        {records.map((record) => (
          <View key={record.id} style={styles.recordItem}>
            <View style={styles.recordHead}>
              <Text style={styles.recordTitle}>{record.activityName}</Text>
              <Text style={styles.recordValue}>{record.durationMinutes} min</Text>
            </View>
            <Text style={styles.recordMeta}>
              {record.recordedOn} · {record.intensity ?? "未填写强度"}
            </Text>
            {record.note ? <Text style={styles.recordNote}>{record.note}</Text> : null}
          </View>
        ))}
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
  tip: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 22
  },
  recordItem: {
    gap: 6,
    borderRadius: 18,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14
  },
  recordHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  recordTitle: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700"
  },
  recordValue: {
    color: "#7dd3fc",
    fontSize: 14,
    fontWeight: "700"
  },
  recordMeta: {
    color: "#94a3b8",
    fontSize: 13
  },
  recordNote: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 20
  }
});
