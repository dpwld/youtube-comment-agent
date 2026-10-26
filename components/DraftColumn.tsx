"use client";

import type { Draft, VideoRow } from "@/lib/types";

type Props = {
  video: VideoRow | null; draft: Draft | null; comment: string; loading: boolean;
  onChange: (s: string) => void; onRegenerate: () => void;
};

export default function DraftColumn({ video, draft, comment, loading, onChange, onRegenerate }: Props) {
  const n = [...comment].length;
  return (
    <section className="flex min-h-[70vh] flex-col rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 p-4">
        <h2 className="text-base font-semibold">② 영상 선택</h2>
        <p className="mt-1 text-xs text-zinc-500">목록에서 영상을 고르면 AI가 고민 한 줄과 댓글 초안을 만들어요.</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!video && <p className="text-sm text-zinc-400">왼쪽 목록에서 영상을 골라 주세요.</p>}
        {video && (
          <div className="flex gap-3">
            <img src={video.thumbnail} alt="" className="h-20 w-36 rounded-md object-cover" />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
              <p className="text-xs text-zinc-500">{video.channel}</p>
              <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" className="text-xs text-blue-600 hover:underline">유튜브에서 보기 ↗</a>
            </div>
          </div>
        )}
        {loading && <p className="animate-pulse text-sm text-zinc-500">자막·인기 댓글을 읽고 초안을 쓰는 중… (10~30초)</p>}
        {draft && !loading && (
          <>
            <div>
              <p className="text-xs font-semibold text-zinc-500">영상 속 고민 한 줄</p>
              <p className="mt-1 rounded-lg bg-zinc-50 p-3 text-sm">{draft.worry}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500">댓글이 언급한 장면 (근거) · 출처: {draft.transcript_source}</p>
              <p className="mt-1 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{draft.scene_ref}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-500">댓글 초안 (수정 가능)</p>
                <span className={`text-xs ${n < 40 || n > 120 ? "text-red-600" : "text-zinc-500"}`}>{n} / 40~120자</span>
              </div>
              <textarea value={comment} onChange={(e) => onChange(e.target.value)} rows={5}
                className="mt-1 w-full rounded-lg border border-zinc-300 p-3 text-sm leading-relaxed" />
              {draft.valid === 0 && <p className="mt-1 text-xs text-red-600">규칙 위반: {draft.violations}</p>}
              <button onClick={onRegenerate} className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50">다시 생성</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
