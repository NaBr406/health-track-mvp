import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, EmptyState, SectionCard, SectionTitle, TextField } from "../../components/ui";
import { api } from "../../lib/api";
import { getTodayString } from "../../lib/utils";
import type { CareRecord } from "../../types";

type CareForm = {
  recordedOn: string;
  category: string;
  itemName: string;
  durationMinutes: string;
  status: string;
  note: string;
};

const initialForm: CareForm = {
  recordedOn: getTodayString(),
  category: "护肤",
  itemName: "",
  durationMinutes: "",
  status: "completed",
  note: ""
};

export function CareScreen() {
  const [focusDate, setFocusDate] = useState(getTodayString());
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [form, setForm] = useState<CareForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadRecords();
  }, [focusDate]);

  async function loadRecords() {
    setLoading(true);
    const nextRecords = await api.getCareRecords(focusDate);
    setRecords(nextRecords);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.itemName) {
      return;
    }

    setSaving(true);
    const created = await api.createCareRecord({
      recordedOn: form.recordedOn,
      category: form.category,
      itemName: form.itemName,
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
      status: form.status,
      note: form.note
    });

    if (created.recordedOn === focusDate) {
      setRecords((current) => [created, ...current]);
    }

    setForm({
      ...initialForm,
      recordedOn: form.recordedOn,
      category: form.category,
      status: form.status
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
        <Text style={styles.tip}>输入 `YYYY-MM-DD` 查看当天护理记录。</Text>
        <TextField label="日期" value={focusDate} onChangeText={setFocusDate} autoCapitalize="none" />
      </SectionCard>

      <SectionCard>
        <SectionTitle>新增护理</SectionTitle>
        <TextField
          label="记录日期"
          value={form.recordedOn}
          onChangeText={(value) => setForm((current) => ({ ...current, recordedOn: value }))}
        />
        <TextField
          label="类别"
          value={form.category}
          onChangeText={(value) => setForm((current) => ({ ...current, category: value }))}
        />
        <TextField
          label="项目"
          value={form.itemName}
          onChangeText={(value) => setForm((current) => ({ ...current, itemName: value }))}
        />
        <TextField
          label="时长（分钟）"
          value={form.durationMinutes}
          onChangeText={(value) => setForm((current) => ({ ...current, durationMinutes: value }))}
          keyboardType="number-pad"
        />
        <TextField
          label="状态"
          value={form.status}
          onChangeText={(value) => setForm((current) => ({ ...current, status: value }))}
        />
        <TextField
          label="备注"
          value={form.note}
          onChangeText={(value) => setForm((current) => ({ ...current, note: value }))}
          multiline
        />
        <Button
          label={saving ? "保存中..." : "保存护理记录"}
          onPress={() => {
            void handleCreate();
          }}
          disabled={saving}
        />
      </SectionCard>

      <SectionCard>
        <SectionTitle>记录列表</SectionTitle>
        {loading ? <Text style={styles.tip}>加载中...</Text> : null}
        {!loading && records.length === 0 ? <EmptyState>当天还没有护理记录。</EmptyState> : null}
        {records.map((record) => (
          <View key={record.id} style={styles.recordItem}>
            <View style={styles.recordHead}>
              <Text style={styles.recordTitle}>{record.itemName}</Text>
              <Text style={styles.recordValue}>{record.durationMinutes ?? 0} min</Text>
            </View>
            <Text style={styles.recordMeta}>
              {record.recordedOn} · {record.category}
            </Text>
            <Text style={styles.recordTag}>{record.status ?? "unknown"}</Text>
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
    color: "#fbbf24",
    fontSize: 14,
    fontWeight: "700"
  },
  recordMeta: {
    color: "#94a3b8",
    fontSize: 13
  },
  recordTag: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: "#fde68a",
    fontSize: 12,
    fontWeight: "700"
  },
  recordNote: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 20
  }
});
