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
import type { DietRecord } from "@/types";

type DietForm = {
  recordedOn: string;
  mealType: string;
  foodName: string;
  calories: string;
  proteinGrams: string;
  carbsGrams: string;
  fatGrams: string;
  note: string;
};

const initialForm = (date: string): DietForm => ({
  recordedOn: date,
  mealType: "早餐",
  foodName: "",
  calories: "",
  proteinGrams: "",
  carbsGrams: "",
  fatGrams: "",
  note: ""
});

export default function DietPage() {
  const [date, setDate] = useState(getTodayString());
  const [records, setRecords] = useState<DietRecord[]>([]);
  const [form, setForm] = useState<DietForm>(initialForm(getTodayString()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecords() {
      setLoading(true);
      const result = await api.getDietRecords(date);
      setRecords(result);
      setForm((current) => ({ ...current, recordedOn: date }));
      setLoading(false);
    }

    void loadRecords();
  }, [date]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await api.createDietRecord({
      recordedOn: form.recordedOn,
      mealType: form.mealType,
      foodName: form.foodName,
      calories: Number(form.calories),
      proteinGrams: form.proteinGrams ? Number(form.proteinGrams) : null,
      carbsGrams: form.carbsGrams ? Number(form.carbsGrams) : null,
      fatGrams: form.fatGrams ? Number(form.fatGrams) : null,
      note: form.note || null
    });
    setRecords((current) => [created, ...current]);
    setForm(initialForm(date));
  }

  return (
    <AppShell
      title="饮食记录"
      description="按日期记录三餐或加餐信息，当前保留热量与三大营养素核心字段，便于 MVP 快速演示。"
    >
      <div className="flex items-center gap-3">
        <Label htmlFor="dietDate">日期</Label>
        <Input
          id="dietDate"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-[180px]"
        />
        {loading ? <span className="text-sm text-slate-400">加载中...</span> : null}
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>新增饮食记录</CardTitle>
            <CardDescription>复杂营养分析和拍照识别后续迭代；当前先保留最小录入闭环。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="recordedOn">记录日期</Label>
                <Input
                  id="recordedOn"
                  type="date"
                  value={form.recordedOn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, recordedOn: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mealType">餐次</Label>
                  <Input
                    id="mealType"
                    value={form.mealType}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, mealType: event.target.value }))
                    }
                    placeholder="早餐 / 午餐 / 晚餐 / 加餐"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="foodName">食物名称</Label>
                  <Input
                    id="foodName"
                    value={form.foodName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, foodName: event.target.value }))
                    }
                    placeholder="鸡胸肉沙拉"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="calories">热量(kcal)</Label>
                  <Input
                    id="calories"
                    type="number"
                    value={form.calories}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, calories: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="protein">蛋白质(g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    value={form.proteinGrams}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, proteinGrams: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="carbs">碳水(g)</Label>
                  <Input
                    id="carbs"
                    type="number"
                    value={form.carbsGrams}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, carbsGrams: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fat">脂肪(g)</Label>
                  <Input
                    id="fat"
                    type="number"
                    value={form.fatGrams}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fatGrams: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dietNote">备注</Label>
                <Textarea
                  id="dietNote"
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="例如：外卖、训练后补餐、控糖餐等"
                />
              </div>
              <Button type="submit">保存饮食记录</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当日饮食历史</CardTitle>
            <CardDescription>支持按日期查询；后续可扩展分页、标签筛选、食材维度统计。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {records.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                当前日期没有饮食记录，先录入一条吧。
              </div>
            ) : (
              records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">
                        {record.mealType} · {record.foodName}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">{record.recordedOn}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-emerald-300">
                        {record.calories} kcal
                      </div>
                      <div className="text-xs text-slate-400">
                        P {record.proteinGrams ?? "-"} / C {record.carbsGrams ?? "-"} / F{" "}
                        {record.fatGrams ?? "-"}
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
