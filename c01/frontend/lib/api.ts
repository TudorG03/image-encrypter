export const getToken = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

export interface JobResponse {
  jobId: string;
  userId: number;
  operation: string;
  mode: string;
  keyHex: string;
  ivHex: string | null;
  status: string;
  downloadUrl: string | null;
  createdAt: string;
}

export async function fetchJobs(): Promise<JobResponse[]> {
  const res = await fetch("/api/jobs", {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to load jobs");
  return res.json();
}
