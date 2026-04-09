import Link from "next/link";

const highlights = [
  "饮食、运动、护理三类记录统一管理",
  "Spring Boot + Next.js 轻量 monorepo",
  "支持 JWT 鉴权与 Swagger 文档",
  "预留 Dify Workflow 接口，方便后续接入真实 AI 建议"
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-8 shadow-glow lg:p-12">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Lightweight MVP · Dify Workflow Ready
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white lg:text-5xl">
              基于 Dify 工作流的个性化饮食、运动、个人护理追踪平台
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-300">
              这个项目聚焦“先能运行、先能演示、再逐步扩展”。前端提供基础页面和可视化，后端提供 JWT、JPA、Swagger、
              Dify API 骨架，适合作为比赛原型或快速 MVP 起点。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-emerald-500 px-5 py-3 font-medium text-emerald-950 transition hover:bg-emerald-400"
              >
                立即体验
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-100 transition hover:bg-slate-800"
              >
                进入仪表盘
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {highlights.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-sm leading-7 text-slate-300 shadow-glow"
            >
              {item}
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
            <h2 className="text-xl font-semibold text-white">Diet Tracking</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              记录餐次、食物、热量、营养素，按日期回查历史，支持后续扩展拍照识别与营养分析。
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
            <h2 className="text-xl font-semibold text-white">Exercise Tracking</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              记录运动类型、时长、消耗与强度，结合目标完成率与周维度趋势图做 MVP 演示。
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
            <h2 className="text-xl font-semibold text-white">AI Advice</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              当前支持 mock + Dify workflow 骨架混合模式，后续只需补配置和 prompt 编排即可接入真实建议。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

