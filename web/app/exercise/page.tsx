"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getTodayString } from "@/lib/utils";
import type { ExerciseRecord } from "@/types";

type ExerciseForm = {
  recordedOn: string;
  activityName: string;
  durationMinutes: string;
  caloriesBurned: string;
  intensity: string;
  note: string;
};

const initialForm = (date: string): ExerciseForm => ({
  recordedOn: date,
  activityName: "",
  durationMinutes: "",
  caloriesBurned: "",
  intensity: "中等",
  note: ""
});

export default function ExercisePage() {
  const [date, setDate] = useState(getTodayString());
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [form, setForm] = useState<ExerciseForm>(initialForm(getTodayString()));

  useEffect(() => {
    async function loadRecords() {
      const result = await api.getExerciseRecords(date);
      setRecords(result);
      setForm((current) => ({ ...current, recordedOn: date }));
    }

    void loadRecords();
  }, [date]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await api.createExerciseRecord({
      recordedOn: form.recordedOn,
      activityName: form.activityName,
      durationMinutes: Number(form.durationMinutes),
      caloriesBurned: form.caloriesBurned ? Number(form.caloriesBurned) : null,
      intensity: form.intensity || null,
      note: form.note || null
    });
    setRecords((current) => [created, ...current]);
    setForm(initialForm(date));
  }

  return (
    <AppShell
      title="运动记录"
      description="记录运动类型、时长、强度与消耗热量，为周趋势分析和 AI 建议提供基础数据。"
    >
      <div className="flex items-center gap-3">
        <Label htmlFor="exerciseDate">日期</Label>
        <Input
          id="exerciseDate"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-[180px]"
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>新增运动记录</CardTitle>
            <CardDescription>后续可接运动设备、课程模版和自动汇总；MVP 阶段先完成最小录入。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="exerciseRecordedOn">记录日期</Label>
                <Input
                  id="exerciseRecordedOn"
                  type="date"
                  value={form.recordedOn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, recordedOn: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activityName">运动类型</Label>
                <Input
                  id="activityName"
                  value={form.activityName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, activityName: event.target.value }))
                  }
                  placeholder="跑步 / 力量训练 / 瑜伽"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="durationMinutes">时长(min)</Label>
                  <Input
                    id="durationMinutes"
                    type="number"
                    value={form.durationMinutes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, durationMinutes: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caloriesBurned">消耗(kcal)</Label>
                  <Input
                    id="caloriesBurned"
                    type="number"
                    value={form.caloriesBurned}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, caloriesBurned: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intensity">强度</Label>
                <Input
                  id="intensity"
                  value={form.intensity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, intensity: event.target.value }))
                  }
                  placeholder="低 / 中等 / 高"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exerciseNote">备注</Label>
                <Textarea
                  id="exerciseNote"
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="例如：训练后心率稳定、膝盖状态良好"
                />
              </div>
              <Button type="submit">保存运动记录</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当日运动历史</CardTitle>
            <CardDescription>支持按日期回看训练安排与完成情况。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {records.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                当前日期没有运动记录。
              </div>
            ) : (
              records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{record.activityName}</div>
                      <div className="mt-1 text-sm text-slate-400">{record.recordedOn}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-cyan-300">
                        {record.durationMinutes} min
                      </div>
                      <div className="text-xs text-slate-400">
                        {record.intensity ?? "未设置强度"} · {record.caloriesBurned ?? 0} kcal
                      </div>
                    </div>
                  </div>
                  {record.note ? (
                    <p className="mt-3 text-sm leading-6 text-slate-300">{record.note}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
