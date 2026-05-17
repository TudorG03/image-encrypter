"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

type Tab = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = tab === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.token);
        router.push("/dashboard");
        return;
      }

      if (res.status === 401) { setError("Invalid credentials."); return; }
      if (res.status === 404) { setError("User not found."); return; }
      if (res.status === 409) { setError("Username already taken."); return; }
      setError("Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors";

  const labelClass = "block text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1.5";

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background blobs */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "400px",
          background: "radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "20%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(ellipse at center, rgba(168,85,247,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Theme toggle — fixed top right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-sm mx-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "32px",
          boxShadow: "0 4px 40px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo / title */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl gradient-bg mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold gradient-text">AES Image Encryptor</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Secure parallel image processing</p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className="relative pb-3 pr-5 text-sm font-medium capitalize transition-colors"
              style={{ color: tab === t ? "var(--text)" : "var(--text-muted)" }}
            >
              {t}
              {tab === t && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full gradient-bg"
                  style={{ marginRight: "8px" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Username</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              placeholder="your-username"
            />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              required
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="gradient-bg text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity mt-1"
          >
            {loading ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
