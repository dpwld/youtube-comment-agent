import { loadConfig } from "@/lib/config";
import { errorResponse } from "@/lib/api";
import { getTopComments } from "@/lib/youtube";
import { getVideos, parseVideoId, searchVideoIds, withRising } from "@/lib/youtube";
import { getDraft, hasCommented, latestFetchedAt, listVideos, upsertVideos, saveDraft, type Video } from "@/lib/store";
import { getTranscript } from "@/lib/transcript";
import { generateDraft, toDraftRow } from "@/lib/draft";

const CACHE_MS = 10 * 60 * 1000;

function decorate(list: Video[]) {
  return list.map((v) => ({ ...withRising(v), commented: hasCommented(v.id), has_draft: !!getDraft(v.id) }));
}

/** GET /api/videos?mode=latest|rising&force=1 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") === "rising" ? "rising" : "latest";
    const force = url.searchParams.get("force") === "1";
    const cfg = loadConfig();
    const last = latestFetchedAt(mode);
    if (!force && last && Date.now() - new Date(last).getTime() < CACHE_MS) {
      return Response.json({ mode, cached: true, videos: decorate(listVideos(mode)) });
    }
    let ids: string[] = [];
    if (mode === "latest") {
      for (const q of cfg.search.keywords) ids.push(...(await searchVideoIds(q, { max: cfg.search.max_results })));
    } else {
      const after = new Date(Date.now() - 48 * 3.6e6).toISOString();
      ids = await searchVideoIds(cfg.search.rising_keyword, { max: 50, publishedAfter: after });
    }
    ids = [...new Set(ids)];
    let videos: Video[] = [];
    for (let i = 0; i < ids.length; i += 50) videos.push(...(await getVideos(ids.slice(i, i + 50), mode)));
    if (mode === "rising") videos = videos.filter((v) => v.rising);
    upsertVideos(videos);
    return Response.json({ mode, cached: false, videos: decorate(videos) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/videos {url} — 링크 직접 입력 → 영상 추가 + 초안 즉시 생성 */
export async function POST(req: Request) {
  try {
    const { url } = (await req.json()) as { url?: string };
    const id = url ? parseVideoId(url) : null;
    if (!id) return Response.json({ error: "BAD_URL", message: "유튜브 영상 링크나 11자 영상 ID를 입력해 주세요" }, { status: 400 });
    const [video] = await getVideos([id], "link");
    if (!video) return Response.json({ error: "NOT_FOUND", message: "영상을 찾을 수 없어요" }, { status: 404 });
    upsertVideos([video]);
    const existing = getDraft(video.id);
    if (existing) return Response.json({ video: decorate([video])[0], draft: existing });
    const [transcript, comments] = await Promise.all([getTranscript(video), getTopComments(video.id)]);
    const r = await generateDraft(video, transcript, comments);
    saveDraft(toDraftRow(video.id, transcript, r));
    return Response.json({ video: decorate([video])[0], draft: getDraft(video.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
