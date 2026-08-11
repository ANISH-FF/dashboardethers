"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid credentials.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-paper">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center border-r border-line bg-white dark:bg-paper-dark">
        <div className="absolute inset-0 bg-gradient-to-br from-paper via-paper-dark to-paper" />
        <div className="relative z-10 w-full max-w-md px-12 flex flex-col items-center justify-center">
          <img 
            src="/uploads/logo.png" 
            alt="Ethers Consultancy Logo" 
            className="w-auto h-32 object-contain drop-shadow-md brightness-0 dark:invert"
          />
          <h2 className="text-xl font-bold tracking-[0.2em] text-ink uppercase text-center mt-2">
            Automation Dashboard
          </h2>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 bg-paper">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-sm font-bold text-paper">
              E
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink tracking-widest uppercase">Ethers</h1>
              <p className="text-[10px] text-ink/40 tracking-widest uppercase">F&B Suite</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-ink">Sign in</h2>
            <p className="mt-1.5 text-sm text-ink/40">Access your management dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label mb-1.5 block text-ink/60">Email</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ethers.in"
                autoFocus
              />
            </div>
            <div>
              <label className="label mb-1.5 block text-ink/60">Password</label>
              <input
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-950/30 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Signing in...
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink/30">
            Staff accounts only. No public registration.
          </p>
        </div>
      </div>
    </main>
  );
}
