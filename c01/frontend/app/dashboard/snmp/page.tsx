"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

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

export default function SnmpPage() {
  const [readings, setReadings] = useState<SnmpReading[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const fetchLatest = async () => {
    try {
      const res = await fetch("/snmp/latest");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReadings(await res.json());
      setLastUpdated(new Date());
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch SNMP data");
    }
  };

  useEffect(() => {
    fetchLatest();
    const id = setInterval(fetchLatest, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">SNMP Node Metrics</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="border px-3 py-2 font-medium">Node</th>
              <th className="border px-3 py-2 font-medium">OS</th>
              <th className="border px-3 py-2 font-medium">CPU (user+sys)</th>
              <th className="border px-3 py-2 font-medium">RAM Used</th>
              <th className="border px-3 py-2 font-medium">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 ? (
              <tr>
                <td colSpan={5} className="border px-3 py-4 text-center text-gray-400">
                  {lastUpdated ? "No data yet." : "Loading…"}
                </td>
              </tr>
            ) : (
              readings.map((r) => (
                <tr key={r.node} className="hover:bg-gray-50">
                  <td className="border px-3 py-2 font-mono font-medium">{r.node}</td>
                  {r.error ? (
                    <td colSpan={3} className="border px-3 py-2 text-red-500">
                      Offline — {r.error}
                    </td>
                  ) : (
                    <>
                      <td className="border px-3 py-2 text-xs text-gray-600">{shortDescr(r.sysDescr)}</td>
                      <td className="border px-3 py-2">{cpuPct(r)}</td>
                      <td className="border px-3 py-2">{ramUsedPct(r)}</td>
                    </>
                  )}
                  <td className="border px-3 py-2 text-xs text-gray-400">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {lastUpdated && (
        <p className="mt-3 text-xs text-gray-400">
          Last updated: {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30s
        </p>
      )}
    </div>
  );
}
