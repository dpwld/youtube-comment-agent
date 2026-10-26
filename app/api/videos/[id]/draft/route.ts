import { errorResponse } from "@/lib/api";
import { generateDraft, toDraftRow } from "@/lib/draft";
import { getDraft, getVideo, saveDraft } from "@/lib/store";
import { getTranscript } from "@/lib/transcript";
import { getTopComments } from "@/lib/youtube";

/** GET: 저장된 초안. POST(?regen=1): 생성/재생성 */
export async function GET(_req: Request, ctx: RouteContext<"/api/videos/[id]/draft">) {
  const { id } = await ctx.params;
  return Response.json({ draft: getDraft(id) });
}

export async function POST(req: Request, ctx: RouteContext<"/api/videos/[id]/draft">) {
  try {
    const { id } = await ctx.params;
    const regen = new URL(req.url).searchParams.get("regen") === "1";
    const video = getVideo(id);
    if (!video) return Response.json({ error: "NOT_FOUND", message: "먼저 영상을 불러와 주세요" }, { status: 404 });
    const existing = getDraft(id);
    if (existing && !regen) return Response.json({ draft: existing });
    const [transcript, comments] = await Promise.all([getTranscript(video), getTopComments(video.id)]);
    const r = await generateDraft(video, transcript, comments);
    saveDraft(toDraftRow(id, transcript, r));
    return Response.json({ draft: getDraft(id) });
  } catch (e) {
    return errorResponse(e);
  }
}
