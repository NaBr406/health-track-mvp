"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@healthtrack.local");
  const [password, setPassword] = useState("Demo123456!");
  const [nickname, setNickname] = useState("Demo User");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const session =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, nickname });
      saveSession(session);
      router.push("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message || "登录失败"
          : "请求失败，请稍后重试"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-8 shadow-glow lg:p-10">
          <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            MVP Login Entry
          </span>
          <h1 className="mt-5 text-4xl font-semibold text-white">
            登录后即可体验健康追踪与 AI 建议流程
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
            当前前端支持 mock 回退：如果后端暂未启动，也能用演示账号直接进入页面查看仪表盘、记录管理和 AI 建议效果。
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="font-medium text-white">演示账号</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              <p>邮箱：demo@healthtrack.local</p>
              <p>密码：Demo123456!</p>
              <p>后端开启 `app.seed.enabled=true` 时会自动写入演示数据。</p>
            </div>
          </div>
        </section>

        <Card className="self-center">
          <CardHeader>
            <div className="flex gap-2">
              <button
                className={`rounded-lg px-3 py-2 text-sm ${
                  mode === "login"
                    ? "bg-emerald-500 text-emerald-950"
                    : "bg-slate-800 text-slate-200"
                }`}
                onClick={() => setMode("login")}
              >
                登录
              </button>
              <button
                className={`rounded-lg px-3 py-2 text-sm ${
                  mode === "register"
                    ? "bg-emerald-500 text-emerald-950"
                    : "bg-slate-800 text-slate-200"
                }`}
                onClick={() => setMode("register")}
              >
                注册
              </button>
            </div>
            <CardTitle className="pt-4">
              {mode === "login" ? "账号登录" : "创建账号"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "登录后访问仪表盘与记录管理"
                : "注册会自动创建默认资料和目标"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <div className="space-y-2">
                  <Label htmlFor="nickname">昵称</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="请输入昵称"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {error}
                </div>
              ) : null}

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "处理中..." : mode === "login" ? "登录并进入仪表盘" : "注册并进入仪表盘"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
