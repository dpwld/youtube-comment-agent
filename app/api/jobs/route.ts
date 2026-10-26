import { errorResponse } from "@/lib/api";
import { validateComment } from "@/lib/draft";
import { startJob } from "@/lib/jobs";
import { activeJob, getVideo, listProfiles, pickProfile, reserveJob } from "@/lib/store";

export async function GET() {
  return Response.json({ job: activeJob() });
}

/** POST {videoId, comment, profile?} → 202 {job} */
export async function POST(req: Request) {
  try {
    const { videoId, comment, profile } = (await req.json()) as { videoId: string; comment: string; profile?: string | null };
    const video = getVideo(videoId);
    if (!video) return Response.json({ error: "NOT_FOUND", message: "먼저 영상을 불러와 주세요" }, { status: 404 });
    if (video.source === "rising")
      return Response.json({ error: "DRAFT_ONLY", message: "'뜨기 직전' 영상은 초안까지만 지원해요" }, { status: 400 });
    const violations = validateComment(comment ?? "");
    if (violations.length) return Response.json({ error: "INVALID_COMMENT", message: `댓글 규칙 위반: ${violations.join(" / ")}` }, { status: 400 });
    const chosen = profile || pickProfile();
    if (!chosen) return Response.json({ error: "NO_PROFILE", message: "로그인된 프로필이 없어요" }, { status: 400 });
    const info = listProfiles().find((p) => p.name === chosen);
    if (!info) return Response.json({ error: "BAD_PROFILE", message: "없는 프로필" }, { status: 400 });
    if (info.logged_in === false) return Response.json({ error: "NOT_LOGGED_IN", message: `${chosen} 프로필은 로그인이 필요해요` }, { status: 400 });
    const job = reserveJob(videoId, chosen, comment);
    startJob(job);
    return Response.json({ job }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
