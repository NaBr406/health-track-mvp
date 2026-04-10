import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { AuthSession } from "../types";
import { AdviceScreen } from "./tabs/AdviceScreen";
import { CareScreen } from "./tabs/CareScreen";
import { DashboardScreen } from "./tabs/DashboardScreen";
import { DietScreen } from "./tabs/DietScreen";
import { ExerciseScreen } from "./tabs/ExerciseScreen";

type HomeScreenProps = {
  session: AuthSession;
  onLogout: () => Promise<void>;
};

type TabKey = "dashboard" | "diet" | "exercise" | "care" | "advice";

const tabs: Array<{ key: TabKey; label: string; title: string; subtitle: string }> = [
  {
    key: "dashboard",
    label: "看板",
    title: "今日健康概览",
    subtitle: "集中查看目标完成率、近 7 天趋势和个人目标"
  },
  {
    key: "diet",
    label: "饮食",
    title: "饮食记录",
    subtitle: "按日期查看并快速新增摄入记录"
  },
  {
    key: "exercise",
    label: "运动",
    title: "运动记录",
    subtitle: "记录训练时长、强度和热量消耗"
  },
  {
    key: "care",
    label: "护理",
    title: "护理记录",
    subtitle: "沉淀睡眠、护肤和日常护理动作"
  },
  {
    key: "advice",
    label: "AI",
    title: "AI 建议",
    subtitle: "查看每日建议与当前输出状态"
  }
];

export function HomeScreen({ session, onLogout }: HomeScreenProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const currentTab = useMemo(
    () => tabs.find((item) => item.key === activeTab) ?? tabs[0],
    [activeTab]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.identityBlock}>
            <Text style={styles.eyebrow}>Health Track Android</Text>
            <Text style={styles.title}>{currentTab.title}</Text>
            <Text style={styles.subtitle}>{currentTab.subtitle}</Text>
          </View>

          <View style={styles.accountCard}>
            <Text style={styles.accountName}>{session.nickname}</Text>
            <Text style={styles.accountEmail}>{session.email}</Text>
            <Pressable
              onPress={() => {
                void onLogout();
              }}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutText}>退出登录</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.screenWrap}>
          {activeTab === "dashboard" ? <DashboardScreen /> : null}
          {activeTab === "diet" ? <DietScreen /> : null}
          {activeTab === "exercise" ? <ExerciseScreen /> : null}
          {activeTab === "care" ? <CareScreen /> : null}
          {activeTab === "advice" ? <AdviceScreen /> : null}
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabButton, activeTab === tab.key ? styles.tabButtonActive : null]}
            >
              <Text style={[styles.tabLabel, activeTab === tab.key ? styles.tabLabelActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020617"
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 14
  },
  topBar: {
    gap: 12
  },
  identityBlock: {
    borderRadius: 28,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 20,
    gap: 6
  },
  eyebrow: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 22
  },
  accountCard: {
    borderRadius: 24,
    backgroundColor: "#07101b",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 4
  },
  accountName: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700"
  },
  accountEmail: {
    color: "#94a3b8",
    fontSize: 13
  },
  logoutButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "rgba(52, 211, 153, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  logoutText: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "700"
  },
  screenWrap: {
    flex: 1
  },
  tabBar: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 26,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 8
  },
  tabButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  tabButtonActive: {
    backgroundColor: "#34d399"
  },
  tabLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700"
  },
  tabLabelActive: {
    color: "#052e2b"
  }
});
