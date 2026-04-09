"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { mockDashboardSummary, mockProfile } from "@/lib/mock";
import { formatDateLabel, getTodayString } from "@/lib/utils";
import type { DashboardSummary, Profile } from "@/types";

type ProfileForm = {
  nickname: string;
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  dailyCalorieGoal: string;
  weeklyExerciseGoalMinutes: string;
  careFocus: string;
  healthGoal: string;
};

function toForm(profile: Profile): ProfileForm {
  return {
    nickname: profile.nickname ?? "",
    age: profile.age?.toString() ?? "",
    gender: profile.gender ?? "",
    heightCm: profile.heightCm?.toString() ?? "",
    weightKg: profile.weightKg?.toString() ?? "",
    targetWeightKg: profile.targetWeightKg?.toString() ?? "",
    dailyCalorieGoal: profile.dailyCalorieGoal?.toString() ?? "",
    weeklyExerciseGoalMinutes: profile.weeklyExerciseGoalMinutes?.toString() ?? "",
    careFocus: profile.careFocus ?? "",
    healthGoal: profile.healthGoal ?? ""
  };
}

export default function DashboardPage() {
  const [focusDate, setFocusDate] = useState(getTodayString());
  const [summary, setSummary] = useState<DashboardSummary>(mockDashboardSummary);
  const [profileForm, setProfileForm] = useState<ProfileForm>(toForm(mockProfile));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [summaryResult, profileResult] = await Promise.all([
        api.getDashboardSummary(focusDate),
        api.getProfile()
      ]);
      setSummary(summaryResult);
      setProfileForm(toForm(profileResult));
      setLoading(false);
    }

    void loadData();
  }, [focusDate]);

  async function handleSaveProfile() {
    setSaving(true);
    const updated = await api.updateProfile({
      nickname: profileForm.nickname,
      age: profileForm.age ? Number(profileForm.age) : null,
      gender: profileForm.gender,
      heightCm: profileForm.heightCm ? Number(profileForm.heightCm) : null,
      weightKg: profileForm.weightKg ? Number(profileForm.weightKg) : null,
      targetWeightKg: profileForm.targetWeightKg ? Number(profileForm.targetWeightKg) : null,
      dailyCalorieGoal: profileForm.dailyCalorieGoal
        ? Number(profileForm.dailyCalorieGoal)
        : null,
      weeklyExerciseGoalMinutes: profileForm.weeklyExerciseGoalMinutes
        ? Number(profileForm.weeklyExerciseGoalMinutes)
        : null,
      careFocus: profileForm.careFocus,
      healthGoal: profileForm.healthGoal
    });
    setProfileForm(toForm(updated));
    setNotice("资料已保存");
    setSaving(false);
  }

  const metrics = [
    {
      label: "今日热量",
      value: `${summary.totalCalories} kcal`,
      helper: `目标 ${summary.dailyCalorieGoal} kcal`
    },
    {
      label: "今日运动",
      value: `${summary.totalExerciseMinutes} min`,
      helper: `本周目标 ${summary.weeklyExerciseGoalMinutes} min`
    },
    {
      label: "护理时长",
      value: `${summary.totalCareMinutes} min`,
      helper: `${summary.careCount} 条护理记录`
    },
    {
      label: "目标完成率",
      value: `${summary.goalCompletionRate}%`,
      helper: "基于饮食与运动简易估算"
    }
  ];

  return (
    <AppShell
      title="健康仪表盘"
      description="集中查看今日摄入、运动、护理与 AI 建议摘要，同时在右侧直接维护个人目标与健康画像。"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="focusDate">统计日期</Label>
        <Input
          id="focusDate"
          type="date"
          value={focusDate}
          onChange={(event) => setFocusDate(event.target.value)}
          className="w-[180px]"
        />
        {loading ? <span className="text-sm text-slate-400">数据加载中...</span> : null}
        {notice ? <span className="text-sm text-emerald-300">{notice}</span> : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-2xl">{item.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">{item.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>近 7 日趋势</CardTitle>
            <CardDescription>
              使用 Recharts 展示热量、运动分钟与护理分钟，便于 MVP 场景快速可视化。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={summary.weeklyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    stroke="#334155"
                  />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#334155" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 12
                    }}
                    labelFormatter={(label) => `日期：${formatDateLabel(String(label))}`}
                  />
                  <Legend />
                  <Bar dataKey="calories" name="热量(kcal)" fill="#22c55e" radius={[8, 8, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="exerciseMinutes"
                    name="运动(min)"
                    stroke="#38bdf8"
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="careMinutes"
                    name="护理(min)"
                    stroke="#f59e0b"
                    strokeWidth={3}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今日摘要</CardTitle>
            <CardDescription>按选择日期快速查看三类记录总览。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-slate-950/70 p-4">
              <div className="text-sm text-slate-400">当前日期</div>
              <div className="mt-2 text-lg font-medium text-white">{focusDate}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <div className="text-sm text-slate-400">饮食记录</div>
                <div className="mt-2 text-2xl font-semibold text-white">{summary.dietCount}</div>
              </div>
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <div className="text-sm text-slate-400">运动记录</div>
                <div className="mt-2 text-2xl font-semibold text-white">{summary.exerciseCount}</div>
              </div>
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <div className="text-sm text-slate-400">护理记录</div>
                <div className="mt-2 text-2xl font-semibold text-white">{summary.careCount}</div>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-7 text-slate-200">
              <div className="font-medium text-emerald-300">AI 建议摘要</div>
              <p className="mt-2 text-slate-200">{summary.latestAdvice}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>资料与健康目标设置</CardTitle>
          <CardDescription>
            MVP 阶段先保留核心字段，后续可继续拆分为详细资料页、目标模板、提醒策略等。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nickname">昵称</Label>
            <Input
              id="nickname"
              value={profileForm.nickname}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, nickname: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">性别</Label>
            <Input
              id="gender"
              value={profileForm.gender}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, gender: event.target.value }))
              }
              placeholder="female / male / other"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">年龄</Label>
            <Input
              id="age"
              type="number"
              value={profileForm.age}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, age: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heightCm">身高(cm)</Label>
            <Input
              id="heightCm"
              type="number"
              value={profileForm.heightCm}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, heightCm: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weightKg">当前体重(kg)</Label>
            <Input
              id="weightKg"
              type="number"
              value={profileForm.weightKg}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, weightKg: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetWeightKg">目标体重(kg)</Label>
            <Input
              id="targetWeightKg"
              type="number"
              value={profileForm.targetWeightKg}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, targetWeightKg: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dailyCalorieGoal">每日热量目标</Label>
            <Input
              id="dailyCalorieGoal"
              type="number"
              value={profileForm.dailyCalorieGoal}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  dailyCalorieGoal: event.target.value
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weeklyExerciseGoalMinutes">每周运动目标(min)</Label>
            <Input
              id="weeklyExerciseGoalMinutes"
              type="number"
              value={profileForm.weeklyExerciseGoalMinutes}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  weeklyExerciseGoalMinutes: event.target.value
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="careFocus">护理关注点</Label>
            <Input
              id="careFocus"
              value={profileForm.careFocus}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, careFocus: event.target.value }))
              }
              placeholder="例如：睡眠、头皮护理、皮肤稳定"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="healthGoal">健康目标</Label>
            <Textarea
              id="healthGoal"
              value={profileForm.healthGoal}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, healthGoal: event.target.value }))
              }
              placeholder="例如：三个月内减脂 3kg，并稳定晚间作息"
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? "保存中..." : "保存资料与目标"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

