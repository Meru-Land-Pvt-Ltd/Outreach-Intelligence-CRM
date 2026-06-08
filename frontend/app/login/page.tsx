"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getApiBase() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
  return value.replace(/\/$/, "");
}

function setAuthCookie(token: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `crm_token=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const value = searchParams.get("next") || "/control-panel";
    return value.startsWith("/") ? value : "/control-panel";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${getApiBase()}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success || !data?.token) {
        throw new Error(data?.message || "Invalid login details.");
      }

      localStorage.setItem("crm_token", data.token);
      localStorage.setItem("crm_user", JSON.stringify(data.user || {}));

      setAuthCookie(data.token);

      router.replace(nextPath);
      router.refresh();
    } catch (error: any) {
      setError(error?.message || "Login failed.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden min-h-[520px] bg-gradient-to-br from-blue-700 via-blue-600 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-blue-700 shadow-sm">
                  O
                </div>

                <div>
                  <h1 className="text-lg font-bold">
                    Outreach Intelligence CRM
                  </h1>
                  <p className="text-sm font-medium text-blue-100">
                    Enoylity Media Creations
                  </p>
                </div>
              </div>

              <div className="mt-16 max-w-md">
                <h2 className="text-4xl font-black leading-tight tracking-tight">
                  Manage outreach, leads, campaigns and reviews from one place.
                </h2>

                <p className="mt-6 text-base font-semibold leading-7 text-blue-100">
                  Secure access for your internal CRM dashboard, intelligence
                  pipeline and Instantly campaign workflow.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm font-bold text-blue-50">
                Protected workspace
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-blue-100">
                Sign in to continue to Control Panel, Raw Data, Brand Map, Email
                Discovery and Instantly workflows.
              </p>
            </div>
          </section>

          <section className="flex min-h-[520px] items-center p-6 sm:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-10 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-sm">
                    O
                  </div>

                  <div>
                    <h1 className="text-lg font-bold text-slate-950">
                      Outreach Intelligence CRM
                    </h1>
                    <p className="text-sm font-medium text-slate-500">
                      Enoylity Media Creations
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-blue-600">
                  Welcome Back
                </p>

                <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                  Sign in to your CRM
                </h2>

                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                  Enter your admin email and password to continue.
                </p>
              </div>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-slate-700">
                    Email
                  </span>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="admin@company.com"
                      required
                      className="h-12 rounded-xl border-slate-200 pl-11 text-sm font-semibold shadow-none focus-visible:ring-4 focus-visible:ring-blue-50"
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-bold text-slate-700">
                    Password
                  </span>

                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                      required
                      className="h-12 rounded-xl border-slate-200 pl-11 text-sm font-semibold shadow-none focus-visible:ring-4 focus-visible:ring-blue-50"
                    />
                  </div>
                </label>

                {error ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl !bg-blue-700 !text-white hover:!bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
