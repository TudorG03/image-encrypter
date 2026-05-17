"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, fetchJobs, type JobResponse } from "@/lib/api";

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

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // form state
  const [file, setFile] = useState<File | null>(null);
  const [operation, setOperation] = useState<Operation>("encrypt");
  const [mode, setMode] = useState<Mode>("ECB");
  const [keyHex, setKeyHex] = useState("");
  const [ivHex, setIvHex] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // progress state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [sseError, setSseError] = useState("");

  // history
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

  const inputClass =
    "border rounded px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const disabledInputClass =
    "border rounded px-3 py-2 w-full text-sm bg-gray-100 cursor-not-allowed text-gray-400";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-gray-800">AES Image Encryptor</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/snmp"
            className="text-sm text-blue-600 hover:text-blue-800 border rounded px-3 py-1"
          >
            SNMP Metrics
          </Link>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700 border rounded px-3 py-1"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Submit form */}
      <section className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-base font-medium text-gray-700 mb-4">Submit Job</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">BMP File</label>
            <input
              type="file"
              accept=".bmp"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Operation</label>
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
              <label className="block text-sm text-gray-600 mb-1">Mode</label>
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

          <div>
            <label className="block text-sm text-gray-600 mb-1">Key (hex)</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={keyHex}
                onChange={(e) => setKeyHex(e.target.value)}
                placeholder="64-character hex string (AES-256 / 32-byte key)"
                className={inputClass + " flex-1"}
              />
              <button
                type="button"
                onClick={() => setKeyHex(generateHex(32))}
                className="text-xs border rounded px-2 py-1 text-blue-600 hover:bg-blue-50 whitespace-nowrap"
              >
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              IV (hex){mode === "ECB" && <span className="text-gray-400 ml-1">(not used for ECB)</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ivHex}
                onChange={(e) => setIvHex(e.target.value)}
                disabled={mode === "ECB"}
                placeholder="32-character hex string"
                className={(mode === "ECB" ? disabledInputClass : inputClass) + " flex-1"}
              />
              <button
                type="button"
                onClick={() => setIvHex(generateHex(16))}
                disabled={mode === "ECB"}
                className="text-xs border rounded px-2 py-1 text-blue-600 hover:bg-blue-50 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate
              </button>
            </div>
          </div>

          {submitError && <p className="text-red-600 text-sm">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium self-start"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>
      </section>

      {/* Progress section */}
      {currentJobId && (
        <section className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-base font-medium text-gray-700 mb-3">Job Status</h2>
          <p className="text-xs text-gray-400 mb-3 font-mono">{currentJobId}</p>

          {processing && (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Processing…</span>
            </div>
          )}

          {sseError && <p className="text-red-600 text-sm">{sseError}</p>}

          {downloadUrl && (
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-sm font-medium">Complete!</span>
              <a
                href={downloadUrl}
                download
                className="text-sm text-blue-600 underline hover:text-blue-800"
              >
                Download Result
              </a>
            </div>
          )}
        </section>
      )}

      {/* Job history */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-base font-medium text-gray-700 mb-4">Job History</h2>

        {historyError && <p className="text-red-600 text-sm mb-3">{historyError}</p>}

        {jobs.length === 0 ? (
          <p className="text-sm text-gray-400">No jobs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="border px-3 py-2 font-medium">Job ID</th>
                  <th className="border px-3 py-2 font-medium">Operation</th>
                  <th className="border px-3 py-2 font-medium">Mode</th>
                  <th className="border px-3 py-2 font-medium">Status</th>
                  <th className="border px-3 py-2 font-medium">Created</th>
                  <th className="border px-3 py-2 font-medium">Download</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.jobId} className="hover:bg-gray-50">
                    <td className="border px-3 py-2 font-mono text-xs" title={job.jobId}>
                      {job.jobId.substring(0, 8)}…
                    </td>
                    <td className="border px-3 py-2">{job.operation}</td>
                    <td className="border px-3 py-2">{job.mode}</td>
                    <td className="border px-3 py-2">{job.status}</td>
                    <td className="border px-3 py-2 text-xs">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="border px-3 py-2">
                      {job.downloadUrl ? (
                        <a
                          href={toRelativeUrl(job.downloadUrl)!}
                          download
                          className="text-blue-600 underline hover:text-blue-800"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
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
