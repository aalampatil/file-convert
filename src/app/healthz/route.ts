import { initialize } from "@/server/services/runtime";
import { officeAvailable } from "@/server/services/supportedFormats";
import { pdfLayoutAvailable } from "@/server/services/pdfLayout";
import { json } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await initialize();
    return json({
      ok: true,
      wordConversion: await officeAvailable(),
      pdfLayout: await pdfLayoutAvailable(),
    });
  } catch {
    return json({ ok: false }, 503);
  }
}
