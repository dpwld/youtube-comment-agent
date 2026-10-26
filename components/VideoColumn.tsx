"use client";

import { useState } from "react";
import Lane from "./Lane";
import type { VideoRow } from "@/lib/types";

type Props = {
  mode: "latest" | "rising"; videos: VideoRow[]; loading: boolean; selectedId: string | null;
  onLoad: (mode: "latest" | "rising", force?: boolean) => void; onSelect: (v: VideoRow) => void; onAddLink: (url: string) => void;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
const fmtNum = (n: number) => n.toLocaleString("ko-KR");

export default function VideoColumn({ mode, videos, loading, selectedId, onLoad, onSelect, onAddLink }: Props) {
  const [link, setLink] = useState("");
  return (
    <Lane step="STEP 1" title="① 영상 불러오기" lead="버튼 한 번에 최신 연애 고민 영상이 목록에 떠요."
      actions={
        <>
          <div className="flex gap-2">
            <button onClick={() => onLoad("latest", true)} disabled={loading}
              className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-50">
              {loading ? "불러오는 중…" : "영상 불러오기"}
            </button>
            <button onClick={() => onLoad("rising", true)} disabled={loading}
              className={`rounded-full border px-4 py-2.5 text-sm font-medium ${mode === "rising" ? "border-accent bg-accent/10 text-accent-deep" : "border-ink/20 text-ink hover:bg-paper"} disabled:opacity-50`}
              title="'연애' 키워드 · 조회수 1,000~5,000 · 시간당 150 이상 (초안까지만)">
              뜨기 직전만
            </button>
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (link.trim()) { onAddLink(link.trim()); setLink(""); } }}>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="유튜브 링크 직접 입력 → 초안 즉시 생성"
              className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none" />
            <button className="rounded-full border border-ink/20 px-4 py-2 text-sm font-medium hover:bg-paper" disabled={loading}>추가</button>
          </form>
        </>
      }>
      <ul className="divide-y divide-line/70">
        {videos.length === 0 && !loading && <li className="p-8 text-center text-sm text-muted">아직 영상이 없어요. 위 버튼을 눌러 주세요.</li>}
        {videos.map((v) => (
          <li key={v.id}>
            <button onClick={() => onSelect(v)}
              className={`flex w-full gap-3 px-6 py-3 text-left transition hover:bg-paper ${selectedId === v.id ? "bg-paper shadow-[inset_3px_0_0_0_var(--color-accent)]" : ""}`}>
              <img src={v.thumbnail} alt="" className="h-16 w-28 flex-none rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{v.title}</p>
                <p className="mt-1 text-xs text-muted">{v.channel} · {fmtDate(v.published_at)} · 조회 {fmtNum(v.view_count)}
                  {v.views_per_hour ? ` · ${fmtNum(v.views_per_hour)}/h` : ""}</p>
                <p className="mt-1.5 flex gap-1 text-[11px]">
                  {v.rising && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-800">{v.source === "rising" ? "뜨기 직전 · 초안만" : "뜨기 직전"}</span>}
                  {v.commented && <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-accent-deep">댓글 완료</span>}
                  {v.source === "link" && <span className="rounded-md bg-ink/5 px-1.5 py-0.5 text-muted">링크 입력</span>}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Lane>
  );
}
