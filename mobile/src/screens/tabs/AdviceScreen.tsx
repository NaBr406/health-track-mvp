import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, SectionCard, SectionTitle, TextField } from "../../components/ui";
import { api } from "../../lib/api";
import { mockAdvice } from "../../lib/mock";
import { getTodayString } from "../../lib/utils";
import type { DailyAdvice } from "../../types";

export function AdviceScreen() {
  const [focusDate, setFocusDate] = useState(getTodayString());
  const [advice, setAdvice] = useState<DailyAdvice>(mockAdvice);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAdvice();
  }, [focusDate]);

  async function loadAdvice() {
    setLoading(true);
    const nextAdvice = await api.getDailyAdvice(focusDate);
    setAdvice(nextAdvice);
    setLoading(false);
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionCard>
        <SectionTitle>建议日期</SectionTitle>
        <TextField label="日期" value={focusDate} onChangeText={setFocusDate} autoCapitalize="none" />
        <Button
          label={loading ? "刷新中..." : "重新获取建议"}
          onPress={() => {
            void loadAdvice();
          }}
          disabled={loading}
        />
      </SectionCard>

      <SectionCard>
        <SectionTitle>输出状态</SectionTitle>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>来源</Text>
          <Text style={styles.metaValue}>{advice.source}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>状态</Text>
          <Text style={styles.metaValue}>{advice.status}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>生成时间</Text>
          <Text style={styles.metaValue}>{advice.generatedAt}</Text>
        </View>
      </SectionCard>

      <SectionCard>
        <SectionTitle>今日 AI 建议</SectionTitle>
        <Text style={styles.adviceText}>{advice.adviceText}</Text>
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
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  metaLabel: {
    color: "#94a3b8",
    fontSize: 13
  },
  metaValue: {
    flex: 1,
    textAlign: "right",
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700"
  },
  adviceText: {
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 26
  }
});
