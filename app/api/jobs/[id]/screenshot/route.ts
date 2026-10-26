import { readFile } from "node:fs/promises";
import { getJob } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]/screenshot">) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job?.screenshot_path) return new Response("no screenshot", { status: 404 });
  try {
    const buf = await readFile(job.screenshot_path);
    return new Response(buf, { headers: { "content-type": "image/png" } });
  } catch {
    return new Response("missing", { status: 404 });
  }
}
