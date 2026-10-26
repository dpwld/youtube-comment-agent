"use client";

import Lane from "./Lane";
import { JOB_LABEL, type Draft, type Job, type ProfileInfo, type VideoRow } from "@/lib/types";

type Props = {
  video: VideoRow | null; draft: Draft | null; comment: string; profiles: ProfileInfo[]; autoProfile: string | null;
  profileChoice: string; onProfileChoice: (s: string) => void; job: Job | null; running: boolean;
  onPost: () => void; onAbort: () => void; onProfileAction: (name: string, action: "check" | "login") => void;
};

const STEPS: Job["status"][] = ["opening_profile", "navigating", "finding_box", "typing", "posting", "verifying", "done"];

export default function PostColumn({ video, draft, comment, profiles, autoProfile, profileChoice, onProfileChoice, job, running, onPost, onAbort, onProfileAction }: Props) {
  const chosen = profileChoice || autoProfile;
  const canPost = !!video && !!draft && comment.trim().length > 0 && !running && !video.commented && video.source !== "rising";
  const reason = !video ? "영상을 먼저 골라 주세요" : !draft ? "초안이 아직 없어요" : video.commented ? "이미 댓글을 단 영상이에요" : video.source === "rising" ? "'뜨기 직전' 영상은 초안까지만" : running ? "작업 진행 중" : null;
  const stepIdx = job ? STEPS.indexOf(job.status) : -1;

  return (
    <Lane step="STEP 3" tone="mint" title="③ 댓글 달기" lead="크롬 프로필이 열리고 한 글자씩 입력해 게시한 뒤, 내 댓글이 보이는지 확인해요."
      actions={
        <>
          <button onClick={onPost} disabled={!canPost}
            className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-deep disabled:bg-ink/15 disabled:text-ink/40">
            {chosen ? `${chosen} 프로필로 댓글 달기` : "댓글 달기"}
          </button>
          {reason && !running && <p className="mt-2 text-xs text-muted">{reason}</p>}
        </>
      }>
      <div className="space-y-5 p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">프로필</p>
          <select value={profileChoice} onChange={(e) => onProfileChoice(e.target.value)} disabled={running}
            className="mt-1.5 w-full rounded-full border border-line bg-white px-4 py-2 text-sm focus:border-accent focus:outline-none">
            <option value="">자동 배정 (순환){autoProfile ? ` → ${autoProfile}` : ""}</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name} disabled={p.logged_in === false}>
                {p.name}{p.logged_in === false ? " (로그인 필요)" : p.logged_in === null ? " (미확인)" : ""} · 오늘 {p.today_count}개
              </option>
            ))}
          </select>
          <ul className="mt-2 divide-y divide-line/70 rounded-xl border border-line bg-white">
            {profiles.map((p) => (
              <li key={p.name} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${p.logged_in ? "bg-accent" : p.logged_in === false ? "bg-danger" : "bg-line"}`} />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted">오늘 {p.today_count}개</span>
                </span>
                <span className="flex gap-3 text-muted">
                  <button onClick={() => onProfileAction(p.name, "check")} disabled={running} className="hover:text-ink">상태 확인</button>
                  <button onClick={() => onProfileAction(p.name, "login")} disabled={running} className="hover:text-ink">로그인</button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {job && (
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">진행 상태 · {job.profile}</p>
            <ol className="mt-2 space-y-1.5">
              {STEPS.map((s, i) => {
                const state = job.status === "failed" ? (i < stepIdx || stepIdx === -1 ? "done" : "idle") : i < stepIdx ? "done" : i === stepIdx ? "now" : "idle";
                return (
                  <li key={s} className={`flex items-center gap-2 text-sm ${state === "now" ? "font-semibold text-ink" : state === "done" ? "text-accent-deep" : "text-muted/60"}`}>
                    <span className="w-4 text-center">{state === "done" ? "✓" : state === "now" ? "●" : "○"}</span>
                    <span>{JOB_LABEL[s]}{state === "now" && job.step_detail ? ` (${job.step_detail})` : ""}</span>
                  </li>
                );
              })}
            </ol>
            {job.status === "done" && job.comment_url && (
              <a href={job.comment_url} target="_blank" className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep">댓글 보기 ↗</a>
            )}
            {job.status === "failed" && (
              <div className="mt-3 text-sm text-danger">
                <p>실패: {job.error}</p>
                {job.screenshot_path && <a href={`/api/jobs/${job.id}/screenshot`} target="_blank" className="text-xs underline">화면 캡처 보기</a>}
              </div>
            )}
            {running && <button onClick={onAbort} className="mt-3 text-xs text-muted underline hover:text-ink">강제 종료</button>}
          </div>
        )}
      </div>
    </Lane>
  );
}
