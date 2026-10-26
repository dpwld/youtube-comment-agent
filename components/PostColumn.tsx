"use client";

import { JOB_LABEL, type Draft, type Job, type ProfileInfo, type VideoRow } from "@/lib/types";

type Props = {
  video: VideoRow | null; draft: Draft | null; comment: string; profiles: ProfileInfo[]; autoProfile: string | null;
  profileChoice: string; onProfileChoice: (s: string) => void; job: Job | null; running: boolean;
  onPost: () => void; onAbort: () => void; onProfileAction: (name: string, action: "check" | "login") => void;
};

const STEPS: Job["status"][] = ["opening_profile", "navigating", "finding_box", "typing", "posting", "verifying", "done"];

export default function PostColumn({ video, draft, comment, profiles, autoProfile, profileChoice, onProfileChoice, job, running, onPost, onAbort, onProfileAction }: Props) {
  const chosen = profileChoice || autoProfile;
  const canPost = !!video && !!draft && comment.trim().length > 0 && !running && !video.commented && !video.rising;
  const reason = !video ? "영상을 먼저 골라 주세요" : !draft ? "초안이 아직 없어요" : video.commented ? "이미 댓글을 단 영상이에요" : video.rising ? "'뜨기 직전' 영상은 초안까지만" : running ? "작업 진행 중" : null;
  const stepIdx = job ? STEPS.indexOf(job.status) : -1;

  return (
    <section className="flex min-h-[70vh] flex-col rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 p-4">
        <h2 className="text-base font-semibold">③ 댓글 달기</h2>
        <p className="mt-1 text-xs text-zinc-500">크롬 프로필이 열리고 한 글자씩 입력해 게시한 뒤, 내 댓글이 보이는지 확인해요.</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <p className="text-xs font-semibold text-zinc-500">프로필</p>
          <select value={profileChoice} onChange={(e) => onProfileChoice(e.target.value)} disabled={running}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            <option value="">자동 배정 (순환){autoProfile ? ` → ${autoProfile}` : ""}</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name} disabled={p.logged_in === false}>
                {p.name}{p.logged_in === false ? " (로그인 필요)" : p.logged_in === null ? " (미확인)" : ""} · 오늘 {p.today_count}개
              </option>
            ))}
          </select>
          <ul className="mt-2 space-y-1">
            {profiles.map((p) => (
              <li key={p.name} className="flex items-center justify-between text-xs text-zinc-600">
                <span>
                  <span className={`mr-1 inline-block h-2 w-2 rounded-full ${p.logged_in ? "bg-emerald-500" : p.logged_in === false ? "bg-red-400" : "bg-zinc-300"}`} />
                  {p.name}
                </span>
                <span className="flex gap-2">
                  <button onClick={() => onProfileAction(p.name, "check")} disabled={running} className="hover:underline">상태 확인</button>
                  <button onClick={() => onProfileAction(p.name, "login")} disabled={running} className="hover:underline">로그인</button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button onClick={onPost} disabled={!canPost}
          className="w-full rounded-lg bg-red-600 px-3 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:bg-zinc-300">
          {chosen ? `${chosen} 프로필로 댓글 달기` : "댓글 달기"}
        </button>
        {reason && !running && <p className="text-xs text-zinc-500">{reason}</p>}

        {job && (
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs text-zinc-500">진행 상태 · {job.profile}</p>
            <ol className="mt-2 space-y-1">
              {STEPS.map((s, i) => {
                const state = job.status === "failed" ? (i < stepIdx || stepIdx === -1 ? "done" : "idle") : i < stepIdx ? "done" : i === stepIdx ? "now" : "idle";
                return (
                  <li key={s} className={`flex items-center gap-2 text-sm ${state === "now" ? "font-semibold text-zinc-900" : state === "done" ? "text-emerald-700" : "text-zinc-400"}`}>
                    <span>{state === "done" ? "✓" : state === "now" ? "●" : "○"}</span>
                    <span>{JOB_LABEL[s]}{state === "now" && job.step_detail ? ` (${job.step_detail})` : ""}</span>
                  </li>
                );
              })}
            </ol>
            {job.status === "done" && job.comment_url && (
              <a href={job.comment_url} target="_blank" className="mt-2 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500">댓글 보기 ↗</a>
            )}
            {job.status === "failed" && (
              <div className="mt-2 text-sm text-red-700">
                <p>실패: {job.error}</p>
                {job.screenshot_path && <a href={`/api/jobs/${job.id}/screenshot`} target="_blank" className="text-xs underline">화면 캡처 보기</a>}
              </div>
            )}
            {running && <button onClick={onAbort} className="mt-2 text-xs text-zinc-500 underline">강제 종료</button>}
          </div>
        )}
      </div>
    </section>
  );
}
