import { supportedFormats } from "@/server/services/supportedFormats";
import { apiError, json, limit } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    limit(request);
    return json(await supportedFormats());
  } catch (err) {
    return apiError(err);
  }
}
