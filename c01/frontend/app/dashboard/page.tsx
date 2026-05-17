"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, fetchJobs, type JobResponse } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

type Operation = "encrypt" | "decrypt";
type Mode = "ECB" | "CBC" | "CFB" | "OFB" | "CTR";

function generateHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toRelativeUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\/[^/]+/, "");
}

function StatusBadge({ status }: { status: string }) {
  const isDone = status === "done";
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={
        isDone
          ? { background: "rgba(34,197,94,0.12)", color: "#16a34a" }
          : { background: "rgba(234,179,8,0.12)", color: "#a16207" }
      }
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: isDone ? "#22c55e" : "#eab308",
          display: "inline-block",
        }}
      />
      {status}
    </span>
  );
}

const inputClass =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors";

const disabledInputClass =
  "w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-faint)] cursor-not-allowed";

const labelClass = "block text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-1.5";

const cardClass = "bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-5";

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [operation, setOperation] = useState<Operation>("encrypt");
  const [mode, setMode] = useState<Mode>("ECB");
  const [keyHex, setKeyHex] = useState("");
  const [ivHex, setIvHex] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [sseError, setSseError] = useState("");

  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [historyError, setHistoryError] = useState("");

  const loadJobHistory = useCallback(async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
      setHistoryError("");
    } catch {
      setHistoryError("Could not load job history.");
    }
  }, []);

  useEffect(() => {
    const t = getToken();
    if (!t) { router.replace("/auth"); return; }
    setToken(t);
    loadJobHistory();
  }, [router, loadJobHistory]);

  function startSSE(jobId: string) {
    setCurrentJobId(jobId);
    setProcessing(true);
    setDownloadUrl(null);
    setSseError("");

    const es = new EventSource(`/stream/${jobId}`);

    es.addEventListener("done", (e: MessageEvent) => {
      es.close();
      setDownloadUrl(toRelativeUrl(e.data));
      setProcessing(false);
      loadJobHistory();
    });

    es.onerror = () => {
      es.close();
      setSseError("Lost connection while waiting for result.");
      setProcessing(false);
      loadJobHistory();
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setSubmitError("Please select a BMP file."); return; }
    if (!token) { router.replace("/auth"); return; }
    setSubmitError("");
    setSubmitting(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("operation", operation);
    fd.append("mode", mode);
    fd.append("keyHex", keyHex);
    if (mode !== "ECB") fd.append("ivHex", ivHex);

    try {
      const res = await fetch("/api/jobs/submit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (res.status === 401) { router.replace("/auth"); return; }

      if (!res.ok) {
        setSubmitError(`Submission failed (${res.status}).`);
        return;
      }

      const data = await res.json();
      startSSE(data.jobId);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    router.replace("/auth");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-lg font-semibold gradient-text">AES Image Encryptor</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/snmp"
            className="text-xs font-medium border border-[var(--border)] text-[var(--text-muted)] rounded-lg px-3 py-1.5 hover:border-indigo-400 hover:text-[var(--text)] transition-colors"
          >
            SNMP Metrics
          </Link>
          <button
            onClick={logout}
            className="text-xs font-medium border border-[var(--border)] text-[var(--text-muted)] rounded-lg px-3 py-1.5 hover:border-red-400 hover:text-red-500 transition-colors"
          >
            Logout
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Submit form */}
      <section className={cardClass}>
        <h2 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-5">
          Submit Job
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* File upload */}
          <div>
            <label className={labelClass}>BMP File</label>
            <label
              className="flex items-center gap-3 cursor-pointer border border-dashed border-[var(--border)] rounded-xl px-4 py-3 hover:border-indigo-400 transition-colors group"
              style={{ background: "var(--bg)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-hover:text-indigo-500 transition-colors flex-shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
              <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors truncate">
                {file ? file.name : "Choose a .bmp file…"}
              </span>
              <input
                type="file"
                accept=".bmp"
                required
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {/* Operation + Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Operation</label>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value as Operation)}
                className={inputClass}
              >
                <option value="encrypt">Encrypt</option>
                <option value="decrypt">Decrypt</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Cipher Mode</label>
              <select
                value={mode}
                onChange={(e) => {
                  const m = e.target.value as Mode;
                  setMode(m);
                  if (m === "ECB") setIvHex("");
                }}
                className={inputClass}
              >
                <option value="ECB">ECB</option>
                <option value="CBC">CBC</option>
                <option value="CFB">CFB</option>
                <option value="OFB">OFB</option>
                <option value="CTR">CTR</option>
              </select>
            </div>
          </div>

          {/* Key hex */}
          <div>
            <label className={labelClass}>Key (AES-256 hex)</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={keyHex}
                onChange={(e) => setKeyHex(e.target.value)}
                placeholder="64-char hex string"
                className={inputClass + " font-mono flex-1"}
              />
              <button
                type="button"
                onClick={() => setKeyHex(generateHex(32))}
                className="flex-shrink-0 text-xs font-medium border border-[var(--border)] text-[var(--text-muted)] rounded-lg px-2.5 hover:border-indigo-400 hover:text-indigo-500 transition-colors whitespace-nowrap"
              >
                Generate
              </button>
            </div>
          </div>

          {/* IV hex */}
          <div>
            <label className={labelClass}>
              IV (hex)
              {mode === "ECB" && (
                <span className="ml-2 normal-case font-normal tracking-normal" style={{ color: "var(--text-faint)" }}>
                  — not used for ECB
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ivHex}
                onChange={(e) => setIvHex(e.target.value)}
                disabled={mode === "ECB"}
                placeholder="32-char hex string"
                className={(mode === "ECB" ? disabledInputClass : inputClass) + " font-mono flex-1"}
              />
              <button
                type="button"
                onClick={() => setIvHex(generateHex(16))}
                disabled={mode === "ECB"}
                className="flex-shrink-0 text-xs font-medium border border-[var(--border)] text-[var(--text-muted)] rounded-lg px-2.5 hover:border-indigo-400 hover:text-indigo-500 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-muted)]"
              >
                Generate
              </button>
            </div>
          </div>

          {submitError && (
            <div
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
              </svg>
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="gradient-bg text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity mt-1"
          >
            {submitting ? "Submitting…" : "Submit Job"}
          </button>
        </form>
      </section>

      {/* Progress section */}
      {currentJobId && (
        <section className={cardClass}>
          <h2 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
            Job Status
          </h2>
          <p className="font-mono text-xs text-[var(--text-faint)] mb-4 break-all">{currentJobId}</p>

          {processing && (
            <div className="flex items-center gap-3">
              <div className="spinner" />
              <span className="text-sm text-[var(--text-muted)]">Processing your image…</span>
            </div>
          )}

          {sseError && (
            <div
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              {sseError}
            </div>
          )}

          {downloadUrl && (
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(34,197,94,0.12)", color: "#16a34a" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Complete
              </span>
              <a
                href={downloadUrl}
                download
                className="gradient-bg text-white text-xs font-semibold rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity"
              >
                Download Result
              </a>
            </div>
          )}
        </section>
      )}

      {/* Job history */}
      <section className={cardClass}>
        <h2 className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">
          Job History
        </h2>

        {historyError && (
          <p className="text-xs text-[var(--error)] mb-3">{historyError}</p>
        )}

        {jobs.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)] py-4 text-center">No jobs yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Job ID", "Op", "Mode", "Status", "Created", "Download"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] px-2 pb-2.5 first:pl-1 last:pr-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {jobs.map((job) => (
                  <tr key={job.jobId} className="group hover:bg-[var(--surface-raised)] transition-colors">
                    <td className="px-2 py-2.5 first:pl-1 last:pr-1">
                      <span className="font-mono text-xs text-[var(--text-muted)]" title={job.jobId}>
                        {job.jobId.substring(0, 8)}…
                      </span>
                    </td>
                    <td className="px-2 py-2.5 first:pl-1 last:pr-1">
                      <span className="text-xs capitalize">{job.operation}</span>
                    </td>
                    <td className="px-2 py-2.5 first:pl-1 last:pr-1">
                      <span className="font-mono text-xs">{job.mode}</span>
                    </td>
                    <td className="px-2 py-2.5 first:pl-1 last:pr-1">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-2 py-2.5 first:pl-1 last:pr-1">
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(job.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 first:pl-1 last:pr-1">
                      {job.downloadUrl ? (
                        <a
                          href={toRelativeUrl(job.downloadUrl)!}
                          download
                          className="text-xs font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-[var(--text-faint)] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
