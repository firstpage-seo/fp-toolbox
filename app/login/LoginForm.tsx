"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginForm({ registerUrl }: { registerUrl: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex-1 grid place-items-center px-6 py-16 bg-background"
      style={{
        backgroundImage:
          "radial-gradient(1000px 420px at 85% -10%, oklch(0.62 0.16 250 / 0.10), transparent), radial-gradient(700px 380px at 0% 110%, oklch(0.69 0.20 24 / 0.07), transparent)",
      }}
    >
      <div className="w-full max-w-[430px] bg-white border border-border rounded-[18px] shadow-[var(--shadow-md)] px-9 py-10">
        <div className="w-14 h-14 rounded-[14px] bg-grad-banner grid place-items-center text-white font-extrabold text-xl tracking-widest mb-5">
          FP
        </div>
        <h1 className="text-[26px] font-extrabold text-navy leading-tight">
          System View Login
        </h1>
        <p className="text-muted text-sm mt-2 mb-7">
          Sign in to open the full dashboard, toolbox and reporting suite.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="username"
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="firstpage"
            required
            autoComplete="username"
          />

          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="w-full min-h-[48px] mt-1.5"
          >
            {loading ? "Logging in…" : "Login"}
          </Button>
        </form>

        <div className="mt-4 px-3.5 py-3 rounded-[10px] bg-fp-500/10 border border-dashed border-fp-500/40 text-[12.5px] leading-relaxed text-fp-700">
          Internal system view. If you don&apos;t have credentials yet, ask the
          AI &amp; Automation team.
        </div>

        <a
          href={registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-[12.5px] font-semibold text-fp-600 hover:underline"
        >
          No account? Register at the MCP admin panel →
        </a>

        <a
          href="/toolbox"
          className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-fp-600"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to Toolbox View
        </a>
      </div>
    </div>
  );
}