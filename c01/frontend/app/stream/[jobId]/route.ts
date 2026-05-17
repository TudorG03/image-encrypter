import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const springUrl = `${process.env.SPRING_URL ?? "http://localhost:8080"}/api/jobs/${jobId}/stream`;

  const upstream = await fetch(springUrl, {
    headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
    cache: "no-store",
  });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
