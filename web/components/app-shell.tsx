"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { clearSession, getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { AuthSession } from "@/types";

const navItems = [
  { href: "/dashboard", label: "仪表盘" },
  { href: "/diet", label: "饮食记录" },
  { href: "/exercise", label: "运动记录" },
  { href: "/care", label: "护理记录" },
  { href: "/advice", label: "AI 建议" }
];

type AppShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AppShell({ title, description, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-glow">
          <Link href="/" className="mb-8 block">
            <div className="text-lg font-semibold text-white">Health Track MVP</div>
            <p className="mt-1 text-sm text-slate-400">Diet · Exercise · Care · AI</p>
          </Link>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-xl px-3 py-2 text-sm transition",
                  pathname === item.href
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-300 hover:bg-slate-800"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            <div className="font-medium text-white">
              {session ? `Hi, ${session.nickname}` : "未登录 / Mock 模式"}
            </div>
            <p className="mt-2 text-slate-400">
              {session
                ? session.email
                : "未检测到本地会话时，页面仍可使用 mock 数据演示。"}
            </p>
            <div className="mt-4 flex gap-2">
              {!session ? (
                <button
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-emerald-950"
                  onClick={() => router.push("/login")}
                >
                  去登录
                </button>
              ) : (
                <button
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100"
                  onClick={() => {
                    clearSession();
                    setSession(null);
                    router.push("/login");
                  }}
                >
                  退出登录
                </button>
              )}
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {description}
              </p>
            ) : null}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
