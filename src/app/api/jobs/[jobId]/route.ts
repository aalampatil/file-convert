import { initialize } from "@/server/services/runtime";
import { getJob } from "@/server/services/jobs";
import { publicJob } from "@/server/services/jobTypes";
import { apiError, json, limit } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    limit(request);
    await initialize();
    const job = await getJob((await params).jobId);
    return job
      ? json(publicJob(job))
      : json({ message: "This conversion was not found or has expired." }, 404);
  } catch (err) {
    return apiError(err);
  }
}
