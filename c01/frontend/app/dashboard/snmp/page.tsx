"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SnmpReading {
  node: string;
  timestamp: string;
  sysDescr?: string;
  cpuUser?: number;
  cpuSystem?: number;
  memTotalKB?: number;
  memAvailKB?: number;
  error?: string;
}

function ramUsedPct(r: SnmpReading): string {
  if (r.memTotalKB == null || r.memAvailKB == null) return "—";
  return (((r.memTotalKB - r.memAvailKB) / r.memTotalKB) * 100).toFixed(1) + "%";
}

function cpuPct(r: SnmpReading): string {
  if (r.cpuUser == null) return "—";
  const total = (r.cpuUser ?? 0) + (r.cpuSystem ?? 0);
  return total.toFixed(1) + "%";
}

function shortDescr(d?: string): string {
  if (!d) return "—";
  const m = d.match(/Linux [^\s]+ [^\s]+/);
  return m ? m[0] : d.substring(0, 40);
}

function NodeIndicator({ online }: { online: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: online ? "#22c55e" : "#ef4444",
        boxShadow: online ? "0 0 0 2px rgba(34,197,94,0.2)" : "0 0 0 2px rgba(239,68,68,0.2)",
        flexShrink: 0,
      }}
    />
  );
}

const REFRESH_INTERVAL = 30;

export default function SnmpPage() {
  const [readings, setReadings] = useState<SnmpReading[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const fetchLatest = async () => {
    try {
      const res = await fetch("/snmp/latest");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReadings(await res.json());
      setLastUpdated(new Date());
      setError("");
      setCountdown(REFRESH_INTERVAL);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch SNMP data");
    }
  };

  useEffect(() => {
    fetchLatest();
    const pollId = setInterval(fetchLatest, REFRESH_INTERVAL * 1000);
    return () => clearInterval(pollId);
  }, []);

  useEffect(() => {
    const tickId = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL));
    }, 1000);
    return () => clearInterval(tickId);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors flex items-center gap-1 mb-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Dashboard
          </Link>
          <h1 className="text-lg font-semibold gradient-text">SNMP Node Metrics</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Refresh in {countdown}s</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 text-xs px-4 py-3 rounded-xl mb-5"
          style={{ background: "rgba(239,68,68,0.08)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {/* Table header */}
        <div
          className="grid text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] px-5 py-3"
          style={{
            gridTemplateColumns: "1.5fr 2fr 1fr 1fr 1fr",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-raised)",
          }}
        >
          <span>Node</span>
          <span>OS</span>
          <span>CPU</span>
          <span>RAM Used</span>
          <span>Last Seen</span>
        </div>

        {readings.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--text-faint)]">
            {lastUpdated ? "No data yet." : "Loading…"}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {readings.map((r) => (
              <div
                key={r.node}
                className="grid items-center px-5 py-3.5 hover:bg-[var(--surface-raised)] transition-colors"
                style={{ gridTemplateColumns: "1.5fr 2fr 1fr 1fr 1fr" }}
              >
                <div className="flex items-center gap-2">
                  <NodeIndicator online={!r.error} />
                  <span className="font-mono text-xs font-medium">{r.node}</span>
                </div>
                {r.error ? (
                  <>
                    <span className="text-xs col-span-3" style={{ color: "var(--error)", opacity: 0.8 }}>
                      Offline — {r.error}
                    </span>
                    <span className="text-xs text-[var(--text-faint)]">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-[var(--text-muted)] truncate pr-2">{shortDescr(r.sysDescr)}</span>
                    <span className="text-xs font-mono">{cpuPct(r)}</span>
                    <span className="text-xs font-mono">{ramUsedPct(r)}</span>
                    <span className="text-xs text-[var(--text-faint)]">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {lastUpdated && (
        <p className="mt-3 text-xs text-[var(--text-faint)]">
          Last updated: {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30s
        </p>
      )}
    </div>
  );
}
