import { errorResponse } from "@/lib/api";
import { abortJob } from "@/lib/jobs";
import { getJob } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ job });
}

/** DELETE: 강제 종료 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  try {
    const { id } = await ctx.params;
    const ok = await abortJob(id);
    return Response.json({ ok });
  } catch (e) {
    return errorResponse(e);
  }
}
