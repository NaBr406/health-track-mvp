"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { mockAdvice, mockDashboardSummary } from "@/lib/mock";
import { getTodayString } from "@/lib/utils";
import type { DailyAdvice, DashboardSummary } from "@/types";

export default function AdvicePage() {
  const [date, setDate] = useState(getTodayString());
  const [advice, setAdvice] = useState<DailyAdvice>(mockAdvice);
  const [summary, setSummary] = useState<DashboardSummary>(mockDashboardSummary);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [adviceResult, summaryResult] = await Promise.all([
      api.getDailyAdvice(date),
      api.getDashboardSummary(date)
    ]);
    setAdvice(adviceResult);
    setSummary(summaryResult);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, [date]);

  return (
    <AppShell
      title="AI 每日建议"
      description="当前已封装 Dify API 骨架；若未配置密钥则自动回落到 mock 建议，方便本地演示和前后端并行开发。"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="adviceDate">建议日期</Label>
        <Input
          id="adviceDate"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-[180px]"
        />
        <Button onClick={loadData} disabled={loading}>
          {loading ? "生成中..." : "重新获取建议"}
        </Button>
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>建议上下文摘要</CardTitle>
            <CardDescription>来自仪表盘汇总接口，可直接作为 Dify 工作流输入的一部分。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="rounded-2xl bg-slate-950/70 p-4">
              <div className="text-sm text-slate-400">今日热量 / 运动</div>
              <div className="mt-2 text-sm leading-7 text-slate-200">
                {summary.totalCalories} kcal · {summary.totalExerciseMinutes} min
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI 输出结果</CardTitle>
            <CardDescription>
              真实环境下这里展示 Dify 工作流返回的个性化建议；MVP 先保留 blocking 模式单次生成。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300">
                source: {advice.source}
              </span>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-300">
                status: {advice.status}
              </span>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                generatedAt: {advice.generatedAt}
              </span>
            </div>

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
              <p className="whitespace-pre-wrap text-sm leading-8 text-slate-100">
                {advice.adviceText}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-7 text-slate-400">
              TODO：后续可扩展流式输出、提示词版本管理、建议采纳反馈、建议日志检索与二次生成。
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
