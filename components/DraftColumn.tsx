"use client";

import Lane from "./Lane";
import type { Draft, VideoRow } from "@/lib/types";

type Props = {
  video: VideoRow | null; draft: Draft | null; comment: string; loading: boolean;
  onChange: (s: string) => void; onRegenerate: () => void;
};

export default function DraftColumn({ video, draft, comment, loading, onChange, onRegenerate }: Props) {
  const n = [...comment].length;
  return (
    <Lane step="STEP 2" title="② 영상 선택" lead="목록에서 영상을 고르면 AI가 고민 한 줄과 댓글 초안을 만들어요.">
      <div className="space-y-5 p-6">
        {!video && !loading && <p className="text-sm text-muted">왼쪽 목록에서 영상을 골라 주세요.</p>}
        {video && (
          <div className="flex gap-3">
            <img src={video.thumbnail} alt="" className="h-20 w-36 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{video.title}</p>
              <p className="mt-0.5 text-xs text-muted">{video.channel}</p>
              <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" className="mt-1 inline-block text-xs font-medium text-accent-deep hover:underline">유튜브에서 보기 ↗</a>
            </div>
          </div>
        )}
        {loading && <p className="animate-pulse text-sm text-muted">자막·인기 댓글을 읽고 초안을 쓰는 중… (10~30초)</p>}
        {draft && !loading && (
          <>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">영상 속 고민 한 줄</p>
              <p className="mt-1.5 rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed">{draft.worry}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">댓글이 언급한 장면 (근거) · 출처: {draft.transcript_source}</p>
              <p className="mt-1.5 rounded-xl bg-paper px-4 py-3 text-sm leading-relaxed text-ink/80">{draft.scene_ref}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">댓글 초안 (수정 가능)</p>
                <span className={`text-xs ${n < 40 || n > 120 ? "font-medium text-danger" : "text-muted"}`}>{n} / 40~120자</span>
              </div>
              <textarea value={comment} onChange={(e) => onChange(e.target.value)} rows={5}
                className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm leading-relaxed focus:border-accent focus:outline-none" />
              {draft.valid === 0 && <p className="mt-1 text-xs text-danger">규칙 위반: {draft.violations}</p>}
              <button onClick={onRegenerate} className="mt-2 rounded-full border border-ink/20 px-4 py-1.5 text-xs font-medium hover:bg-paper">다시 생성</button>
            </div>
          </>
        )}
      </div>
    </Lane>
  );
}
