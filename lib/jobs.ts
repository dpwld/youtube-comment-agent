import { mkdirSync } from "node:fs";
import path from "node:path";
import type { BrowserContext } from "playwright";
import { screenshotsDir } from "./config";
import { openProfile, isLoggedIn } from "./browser";
import { postComment } from "./poster";
import { getJob, getVideo, logComment, setProfileState, updateJob, type Job } from "./store";

type Live = { jobId: string; context: BrowserContext | null; aborted: boolean };
const g = globalThis as unknown as { __ytAgentJobs?: { live: Live | null } };
const reg = (g.__ytAgentJobs ??= { live: null });

const JOB_TIMEOUT_MS = 180_000;

export function startJob(job: Job): void {
  const live: Live = { jobId: job.id, context: null, aborted: false };
  reg.live = live;
  void runJob(job, live).finally(() => { if (reg.live?.jobId === job.id) reg.live = null; });
}

export async function abortJob(jobId: string): Promise<boolean> {
  const live = reg.live;
  if (!live || live.jobId !== jobId) return false;
  live.aborted = true;
  await captureScreenshot(live, jobId); // 창을 닫기 전에 화면을 남긴다
  await live.context?.close().catch(() => {});
  return true;
}

async function captureScreenshot(live: Live, jobId: string): Promise<string | null> {
  try {
    const page = live.context?.pages()[0];
    if (!page || page.isClosed()) return null;
    mkdirSync(screenshotsDir(), { recursive: true });
    const file = path.join(screenshotsDir(), `${jobId}.png`);
    await page.screenshot({ path: file, fullPage: false });
    updateJob(jobId, { screenshot_path: file });
    return file;
  } catch { return null; }
}

async function runJob(job: Job, live: Live): Promise<void> {
  const video = getVideo(job.video_id);
  const title = video?.title ?? job.video_id;
  const fail = async (code: string, message: string) => {
    const screenshot = (await captureScreenshot(live, job.id)) ?? getJob(job.id)?.screenshot_path ?? null;
    const reached = getJob(job.id)?.status; // 실패 직전까지 간 단계 (화면 표시용)
    updateJob(job.id, { status: "failed", step_detail: reached && reached !== "failed" ? reached : null, error: `${code}: ${message}`, screenshot_path: screenshot });
    logComment({ video_id: job.video_id, video_title: title, profile: job.profile, comment: job.comment, ok: 0, reason: `${code}: ${message}`, job_id: job.id });
  };

  const timer = setTimeout(() => { live.aborted = true; live.context?.close().catch(() => {}); }, JOB_TIMEOUT_MS);
  try {
    updateJob(job.id, { status: "opening_profile", step_detail: job.profile });
    live.context = await openProfile(job.profile);
    const page = live.context.pages()[0] ?? (await live.context.newPage());

    updateJob(job.id, { status: "navigating" });
    await page.goto(`https://www.youtube.com/watch?v=${job.video_id}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const loggedIn = await isLoggedIn(page);
    setProfileState(job.profile, loggedIn);
    if (!loggedIn) { await fail("NOT_LOGGED_IN", `${job.profile} 프로필이 유튜브에 로그인되어 있지 않습니다`); return; }

    const result = await postComment(page, job.comment, (step, detail) => {
      if (live.aborted) return;
      updateJob(job.id, { status: step, step_detail: detail ?? null });
    });
    if (live.aborted) { await fail("ABORTED", "사용자가 중단했거나 시간(180초)을 초과했습니다"); return; }
    if (!result.ok) { await fail(result.code, result.message); return; }

    updateJob(job.id, { status: "done", step_detail: null, comment_url: result.commentUrl ?? `https://www.youtube.com/watch?v=${job.video_id}` });
    logComment({ video_id: job.video_id, video_title: title, profile: job.profile, comment: job.comment, ok: 1, reason: null, job_id: job.id });
    await page.waitForTimeout(3_000); // 화면에서 결과 확인할 시간
  } catch (e) {
    const current = getJob(job.id);
    if (current && current.status !== "failed" && current.status !== "done") {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
      await fail(live.aborted ? "ABORTED" : "UNEXPECTED", live.aborted ? "사용자가 중단했거나 시간(180초)을 초과했습니다" : msg);
    }
  } finally {
    clearTimeout(timer);
    await live.context?.close().catch(() => {});
  }
}
