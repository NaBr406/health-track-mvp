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
import type { CareRecord } from "@/types";

type CareForm = {
  recordedOn: string;
  category: string;
  itemName: string;
  durationMinutes: string;
  status: string;
  note: string;
};

const initialForm = (date: string): CareForm => ({
  recordedOn: date,
  category: "护肤",
  itemName: "",
  durationMinutes: "",
  status: "completed",
  note: ""
});

export default function CarePage() {
  const [date, setDate] = useState(getTodayString());
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [form, setForm] = useState<CareForm>(initialForm(getTodayString()));

  useEffect(() => {
    async function loadRecords() {
      const result = await api.getCareRecords(date);
      setRecords(result);
      setForm((current) => ({ ...current, recordedOn: date }));
    }

    void loadRecords();
  }, [date]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await api.createCareRecord({
      recordedOn: form.recordedOn,
      category: form.category,
      itemName: form.itemName,
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
      status: form.status || null,
      note: form.note || null
    });
    setRecords((current) => [created, ...current]);
    setForm(initialForm(date));
  }

  return (
    <AppShell
      title="个人护理记录"
      description="MVP 先关注护肤、睡眠、放松、日常护理等基础打卡，为后续个性化建议提供数据。"
    >
      <div className="flex items-center gap-3">
        <Label htmlFor="careDate">日期</Label>
        <Input
          id="careDate"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-[180px]"
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>新增护理记录</CardTitle>
            <CardDescription>例如护肤、睡眠、冥想、头皮护理、拉伸放松等。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="careRecordedOn">记录日期</Label>
                <Input
                  id="careRecordedOn"
                  type="date"
                  value={form.recordedOn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, recordedOn: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">分类</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value }))
                    }
                    placeholder="护肤 / 睡眠 / 放松"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemName">项目名称</Label>
                  <Input
                    id="itemName"
                    value={form.itemName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, itemName: event.target.value }))
                    }
                    placeholder="晚间护肤 / 23:00 前入睡"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="careDurationMinutes">时长(min)</Label>
                  <Input
                    id="careDurationMinutes"
                    type="number"
                    value={form.durationMinutes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, durationMinutes: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="careStatus">状态</Label>
                  <Input
                    id="careStatus"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, status: event.target.value }))
                    }
                    placeholder="completed / skipped / partial"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="careNote">备注</Label>
                <Textarea
                  id="careNote"
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="例如：今晚提前半小时护肤，状态更稳定"
                />
              </div>
              <Button type="submit">保存护理记录</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当日护理历史</CardTitle>
            <CardDescription>可按日期查看护理习惯是否保持稳定。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {records.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                当前日期没有护理记录。
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
                        {record.category} · {record.itemName}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">{record.recordedOn}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-amber-300">
                        {record.durationMinutes ?? 0} min
                      </div>
                      <div className="text-xs text-slate-400">{record.status ?? "未设置状态"}</div>
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
