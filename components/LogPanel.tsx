"use client";

import type { LogRow } from "@/lib/types";

const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function LogPanel({ rows }: { rows: LogRow[] }) {
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex items-baseline gap-3 p-6 pb-4">
        <h2 className="text-lg font-semibold tracking-tight">기록</h2>
        <p className="text-sm text-muted">어느 영상에 · 어느 프로필로 · 무슨 댓글을 · 성공/실패, 시간순.</p>
      </div>
      <div className="max-h-72 overflow-y-auto border-t border-line/70">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-muted">
            <tr><th className="px-6 py-2 font-semibold">시각</th><th className="px-2 py-2 font-semibold">영상</th><th className="px-2 py-2 font-semibold">프로필</th><th className="px-2 py-2 font-semibold">댓글</th><th className="px-2 py-2 font-semibold">결과</th></tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted">아직 기록이 없어요.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-paper">
                <td className="whitespace-nowrap px-6 py-2.5 text-muted">{fmt(r.ts)}</td>
                <td className="max-w-[220px] truncate px-2 py-2.5" title={r.video_title}><a href={`https://www.youtube.com/watch?v=${r.video_id}`} target="_blank" className="hover:underline">{r.video_title || r.video_id}</a></td>
                <td className="whitespace-nowrap px-2 py-2.5">{r.profile}</td>
                <td className="max-w-[420px] truncate px-2 py-2.5" title={r.comment}>{r.comment}</td>
                <td className="whitespace-nowrap px-2 py-2.5">
                  {r.ok ? <span className="font-medium text-accent-deep">성공</span> : <span className="font-medium text-danger" title={r.reason ?? ""}>실패 · {r.reason?.split(":")[0]}</span>}
                  {!r.ok && r.job_id && <a href={`/api/jobs/${r.job_id}/screenshot`} target="_blank" className="ml-1 text-muted underline">캡처</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
