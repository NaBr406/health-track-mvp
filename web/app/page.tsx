import Link from "next/link";

const navItems = [
  { label: "产品亮点", href: "#preview" },
  { label: "仪表盘", href: "/dashboard" },
  { label: "饮食", href: "/diet" },
  { label: "运动", href: "/exercise" },
  { label: "护理", href: "/care" },
  { label: "AI 建议", href: "/advice" }
];

const quickStats = [
  {
    value: "7 天",
    label: "趋势聚合",
    description: "饮食、运动、护理在一个界面保持同频。"
  },
  {
    value: "1 次登录",
    label: "统一会话",
    description: "登录后快速进入记录、目标与建议闭环。"
  },
  {
    value: "实时",
    label: "AI 响应",
    description: "支持 Dify 工作流与本地演示双模式。"
  }
];

const entries = [
  {
    label: "Dashboard",
    title: "仪表盘总览",
    description: "查看当日摄入、运动分钟、护理时长与目标完成率，直接把状态变化集中展示。",
    href: "/dashboard",
    meta: "趋势图 · 目标设置 · 日摘要"
  },
  {
    label: "Diet",
    title: "饮食记录",
    description: "按餐次记录热量与三大营养素，保留足够简洁的输入成本，也为后续分析留好接口。",
    href: "/diet",
    meta: "早餐 / 午餐 / 晚餐 / 加餐"
  },
  {
    label: "Exercise",
    title: "运动记录",
    description: "记录项目、时长、消耗和强度，让训练数据能自然进入每周趋势与每日建议。",
    href: "/exercise",
    meta: "训练类型 · 时长 · 强度"
  },
  {
    label: "Care",
    title: "护理记录",
    description: "把护肤、睡眠和放松习惯沉淀成稳定轨迹，使护理不再是被忽略的边缘模块。",
    href: "/care",
    meta: "睡眠 · 护肤 · 放松"
  },
  {
    label: "AI",
    title: "AI 每日建议",
    description: "围绕当天记录和目标自动生成建议，适合做 MVP 演示，也便于后续接入真实工作流。",
    href: "/advice",
    meta: "建议生成 · 日志留存 · 二次扩展"
  }
];

const detailRows = [
  {
    title: "极简导航",
    description: "功能入口直接出现在顶部导航中，访问路径更短，演示时也更自然。"
  },
  {
    title: "玻璃质感界面",
    description: "通过透明层、柔和高光和背景景深建立秩序感，而不是依赖复杂装饰。"
  },
  {
    title: "可持续扩展",
    description: "首页保留产品感，但业务入口都是真实路径，后续继续扩内容时不会推倒重来。"
  }
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-drift" />
        <div className="absolute right-[-6rem] top-40 h-80 w-80 rounded-full bg-sky-300/10 blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-200/10 blur-3xl animate-float-slow" />
      </div>

      <header className="sticky top-0 z-30 px-4 pt-5">
        <div className="glass-panel mx-auto flex max-w-7xl items-center gap-4 rounded-full px-4 py-3 md:px-6">
          <Link href="/" className="shrink-0">
            <div className="text-sm font-semibold uppercase tracking-[0.35em] text-white/78">
              Health Track
            </div>
          </Link>

          <nav
            aria-label="首页导航"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto text-sm text-slate-300"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="glass-chip shrink-0 rounded-full px-4 py-2 transition duration-300 hover:-translate-y-0.5 hover:bg-white/12 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/login"
            className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-100"
          >
            登录体验
          </Link>
        </div>
      </header>

      <section className="relative px-4 pb-16 pt-10 lg:pb-24 lg:pt-14">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="animate-fade-up">
              <span className="glass-chip inline-flex rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.32em] text-white/70">
                Personalized Daily Health Flow
              </span>
            </div>

            <div className="space-y-5 animate-fade-up animate-fade-up-delay-1">
              <h1 className="max-w-5xl text-balance text-[clamp(3.5rem,7vw,7rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-white">
                用更克制的界面，
                <br />
                承载更完整的健康日常。
              </h1>
              <p className="max-w-2xl text-balance text-lg leading-8 text-[color:var(--page-muted)] md:text-xl">
                这是一个面向饮食、运动、护理与 AI 建议的轻量健康追踪入口。首页保持极简，但所有功能都能在一层之内被清晰抵达。
              </p>
            </div>

            <div className="flex flex-wrap gap-3 animate-fade-up animate-fade-up-delay-2">
              <Link
                href="/dashboard"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-100"
              >
                进入仪表盘
              </Link>
              <Link
                href="#entries"
                className="glass-chip rounded-full px-6 py-3 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/12"
              >
                查看功能入口
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 animate-fade-up animate-fade-up-delay-3">
              {quickStats.map((item) => (
                <div key={item.label} className="glass-panel rounded-[28px] p-5">
                  <div className="text-2xl font-semibold tracking-[-0.04em] text-white">
                    {item.value}
                  </div>
                  <div className="mt-2 text-sm font-medium text-white/82">{item.label}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-fade-in">
            <div className="glass-panel relative overflow-hidden rounded-[40px] p-5 md:p-7">
              <div className="absolute inset-x-6 top-0 h-px bg-white/30" />
              <div className="flex items-center justify-between border-b glass-divider pb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-white/55">
                    Today Snapshot
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                    Daily Coordination
                  </div>
                </div>
                <div className="glass-chip rounded-full px-3 py-1 text-xs text-white/72">
                  Live Preview
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                <div className="glass-chip rounded-[28px] p-5">
                  <div className="text-xs uppercase tracking-[0.28em] text-white/50">
                    Goal Balance
                  </div>
                  <div className="mt-4 text-5xl font-semibold tracking-[-0.08em] text-white">
                    82%
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    今日摄入、运动完成度与护理节奏保持在相对稳定的节拍中。
                  </p>
                  <div className="mt-6 space-y-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                        <span>饮食目标</span>
                        <span>1,420 / 1,800 kcal</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div className="h-2 w-[78%] rounded-full bg-white/80 shimmer-line" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                        <span>运动目标</span>
                        <span>95 / 180 min</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div className="h-2 w-[56%] rounded-full bg-sky-300/80 shimmer-line" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="glass-chip rounded-[28px] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.28em] text-white/50">
                          AI Advice
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          今日建议摘要
                        </div>
                      </div>
                      <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/65">
                        Dify Ready
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      保持早餐高蛋白结构，训练后补充拉伸恢复，晚间护理尽量维持固定时段，帮助身体进入稳定节奏。
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="glass-chip rounded-[28px] p-5 animate-float-slow">
                      <div className="text-xs uppercase tracking-[0.28em] text-white/50">
                        Diet
                      </div>
                      <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">
                        3
                      </div>
                      <div className="mt-2 text-sm text-slate-400">当日饮食记录</div>
                    </div>
                    <div className="glass-chip rounded-[28px] p-5 [animation-delay:1.6s] animate-float-slow">
                      <div className="text-xs uppercase tracking-[0.28em] text-white/50">
                        Exercise
                      </div>
                      <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">
                        45
                      </div>
                      <div className="mt-2 text-sm text-slate-400">累计运动分钟</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel absolute -bottom-6 left-6 hidden max-w-xs rounded-[28px] p-4 lg:block">
              <div className="text-xs uppercase tracking-[0.28em] text-white/50">Care Routine</div>
              <div className="mt-3 text-sm leading-6 text-slate-300">
                晚间护理、睡眠和拉伸被纳入同一条日常轨迹，而不是零散的待办事项。
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="preview" className="px-4 py-12 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-panel rounded-[36px] p-7 md:p-9">
            <div className="text-xs uppercase tracking-[0.32em] text-white/52">
              Product Direction
            </div>
            <h2 className="mt-4 max-w-xl text-balance text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
              极简，不代表信息稀薄。
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-400">
              首页把产品定位、业务闭环与功能入口集中到一个干净的首屏体验中。视觉上尽量留白，交互上尽量缩短路径。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {detailRows.map((item, index) => (
              <div
                key={item.title}
                className="glass-panel rounded-[32px] p-6 transition duration-300 hover:-translate-y-1"
              >
                <div className="text-xs uppercase tracking-[0.3em] text-white/45">
                  0{index + 1}
                </div>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-white">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="entries" className="px-4 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-white/48">
                Functional Entry Points
              </div>
              <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                主页里的每一个模块，都能直接进入真实功能。
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-400">
              导航栏负责快速切换，主页卡片负责帮助用户理解模块价值，两层入口保持统一，不让首页沦为只有宣传语的空页面。
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {entries.map((item, index) => (
              <article
                key={item.title}
                className={`glass-panel group rounded-[34px] p-6 transition duration-500 hover:-translate-y-1.5 hover:bg-white/[0.14] ${
                  index === 0 || index === 4 ? "lg:col-span-2" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.32em] text-white/48">
                    {item.label}
                  </div>
                  <div className="rounded-full bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
                    Entry
                  </div>
                </div>

                <h3 className="mt-8 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {item.title}
                </h3>
                <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
                  {item.description}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <span className="glass-chip rounded-full px-3 py-2 text-xs text-white/62">
                    {item.meta}
                  </span>
                  <Link
                    href={item.href}
                    className="rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-white transition duration-300 group-hover:border-white/24 group-hover:bg-white/10"
                  >
                    打开模块
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-12">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="glass-panel rounded-[38px] p-7 md:p-9">
            <div className="text-xs uppercase tracking-[0.32em] text-white/48">
              Experience Flow
            </div>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
              从记录，到建议，再到第二天的行动。
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-400">
              这个首页不是单纯的品牌封面，而是把产品逻辑清晰铺开。用户进入后先看整体价值，再在同一页完成模块选择，自然过渡到实际操作。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-100"
              >
                开始体验
              </Link>
              <Link
                href="/advice"
                className="glass-chip rounded-full px-6 py-3 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/12"
              >
                查看 AI 建议页
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-panel rounded-[34px] p-6">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.3em] text-white/48">
                  Daily Rhythm
                </div>
                <div className="rounded-full bg-sky-300/10 px-3 py-1 text-xs text-sky-200/90">
                  Coordinated
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] bg-white/5 p-4">
                  <div className="text-sm font-medium text-white">早晨</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">早餐记录与热量确认</div>
                </div>
                <div className="rounded-[24px] bg-white/5 p-4">
                  <div className="text-sm font-medium text-white">傍晚</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">运动输入与趋势更新</div>
                </div>
                <div className="rounded-[24px] bg-white/5 p-4">
                  <div className="text-sm font-medium text-white">夜间</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">护理打卡与建议生成</div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[34px] p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-white/48">
                Navigation Consistency
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {navItems.slice(1).map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/82 transition duration-300 hover:border-white/24 hover:bg-white/10"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
