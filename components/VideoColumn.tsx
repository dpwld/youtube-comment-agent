"use client";

import { useState } from "react";
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
    <section className="flex min-h-[70vh] flex-col rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 p-4">
        <h2 className="text-base font-semibold">① 영상 불러오기</h2>
        <p className="mt-1 text-xs text-zinc-500">버튼 한 번에 최신 연애 고민 영상이 목록에 떠요.</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => onLoad("latest", true)} disabled={loading}
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
            {loading ? "불러오는 중…" : "영상 불러오기"}
          </button>
          <button onClick={() => onLoad("rising", true)} disabled={loading}
            className={`rounded-lg border px-3 py-2 text-sm ${mode === "rising" ? "border-amber-400 bg-amber-50 text-amber-800" : "border-zinc-300 hover:bg-zinc-50"} disabled:opacity-50`}
            title="'연애' 키워드 · 조회수 1,000~5,000 · 시간당 150 이상 (초안까지만)">
            뜨기 직전만
          </button>
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (link.trim()) { onAddLink(link.trim()); setLink(""); } }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="유튜브 링크 직접 입력 → 초안 즉시 생성"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" />
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50" disabled={loading}>추가</button>
        </form>
      </div>
      <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto">
        {videos.length === 0 && !loading && <li className="p-6 text-center text-sm text-zinc-400">아직 영상이 없어요. 위 버튼을 눌러 주세요.</li>}
        {videos.map((v) => (
          <li key={v.id}>
            <button onClick={() => onSelect(v)}
              className={`flex w-full gap-3 p-3 text-left hover:bg-zinc-50 ${selectedId === v.id ? "bg-blue-50" : ""}`}>
              <img src={v.thumbnail} alt="" className="h-16 w-28 flex-none rounded-md object-cover" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium">{v.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{v.channel} · {fmtDate(v.published_at)} · 조회 {fmtNum(v.view_count)}
                  {v.views_per_hour ? ` · ${fmtNum(v.views_per_hour)}/h` : ""}</p>
                <p className="mt-1 flex gap-1 text-[11px]">
                  {v.rising && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">뜨기 직전 · 초안만</span>}
                  {v.commented && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">댓글 완료</span>}
                  {v.source === "link" && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">링크 입력</span>}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
