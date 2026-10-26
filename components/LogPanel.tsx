"use client";

import type { LogRow } from "@/lib/types";

const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function LogPanel({ rows }: { rows: LogRow[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 p-4">
        <h2 className="text-base font-semibold">기록</h2>
        <p className="mt-1 text-xs text-zinc-500">어느 영상에 · 어느 프로필로 · 무슨 댓글을 · 성공/실패, 시간순.</p>
      </div>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-zinc-50 text-zinc-500">
            <tr><th className="px-4 py-2">시각</th><th className="px-2 py-2">영상</th><th className="px-2 py-2">프로필</th><th className="px-2 py-2">댓글</th><th className="px-2 py-2">결과</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">아직 기록이 없어요.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{fmt(r.ts)}</td>
                <td className="max-w-[220px] truncate px-2 py-2" title={r.video_title}><a href={`https://www.youtube.com/watch?v=${r.video_id}`} target="_blank" className="hover:underline">{r.video_title || r.video_id}</a></td>
                <td className="whitespace-nowrap px-2 py-2">{r.profile}</td>
                <td className="max-w-[420px] truncate px-2 py-2" title={r.comment}>{r.comment}</td>
                <td className="whitespace-nowrap px-2 py-2">
                  {r.ok ? <span className="text-emerald-700">성공</span> : <span className="text-red-700" title={r.reason ?? ""}>실패 · {r.reason?.split(":")[0]}</span>}
                  {!r.ok && r.job_id && <a href={`/api/jobs/${r.job_id}/screenshot`} target="_blank" className="ml-1 text-zinc-500 underline">캡처</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
