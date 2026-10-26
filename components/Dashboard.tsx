"use client";

import { useCallback, useEffect, useState } from "react";
import VideoColumn from "./VideoColumn";
import DraftColumn from "./DraftColumn";
import PostColumn from "./PostColumn";
import LogPanel from "./LogPanel";
import type { Draft, Job, LogRow, ProfileInfo, VideoRow } from "@/lib/types";

type Mode = "latest" | "rising";
type LogState = { log: LogRow[]; today: number; today_success: number; daily_max: number };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  return body;
}

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>("latest");
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selected, setSelected] = useState<VideoRow | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [comment, setComment] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [autoProfile, setAutoProfile] = useState<string | null>(null);
  const [profileChoice, setProfileChoice] = useState<string>("");
  const [job, setJob] = useState<Job | null>(null);
  const [logState, setLogState] = useState<LogState>({ log: [], today: 0, today_success: 0, daily_max: 10 });
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); }, []);

  const refreshProfiles = useCallback(async () => {
    const r = await api<{ profiles: ProfileInfo[]; auto: string | null }>("/api/profiles");
    setProfiles(r.profiles); setAutoProfile(r.auto);
  }, []);
  const refreshLog = useCallback(async () => setLogState(await api<LogState>("/api/log")), []);

  useEffect(() => {
    void (async () => {
      await Promise.allSettled([refreshProfiles(), refreshLog()]);
      const r = await api<{ job: Job | null }>("/api/jobs").catch(() => null);
      if (r?.job) setJob(r.job);
    })();
  }, [refreshProfiles, refreshLog]);

  // 진행 중인 작업 1초 폴링
  useEffect(() => {
    if (!job || job.status === "done" || job.status === "failed") return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ job: Job }>(`/api/jobs/${job.id}`);
        setJob(r.job);
        if (r.job.status === "done" || r.job.status === "failed") {
          await Promise.all([refreshLog(), refreshProfiles()]);
          setVideos((vs) => vs.map((v) => (v.id === r.job.video_id && r.job.status === "done" ? { ...v, commented: true } : v)));
        }
      } catch { /* 다음 틱 */ }
    }, 1000);
    return () => clearInterval(t);
  }, [job, refreshLog, refreshProfiles]);

  const loadVideos = async (m: Mode, force = false) => {
    setLoadingVideos(true);
    try {
      const r = await api<{ videos: VideoRow[] }>(`/api/videos?mode=${m}${force ? "&force=1" : ""}`);
      setMode(m); setVideos(r.videos);
    } catch (e) { notify((e as Error).message); }
    finally { setLoadingVideos(false); }
  };

  const selectVideo = async (v: VideoRow) => {
    setSelected(v); setDraft(null); setComment(""); setLoadingDraft(true);
    try {
      const r = await api<{ draft: Draft }>(`/api/videos/${v.id}/draft`, { method: "POST" });
      setDraft(r.draft); setComment(r.draft.comment);
      setVideos((vs) => vs.map((x) => (x.id === v.id ? { ...x, has_draft: true } : x)));
    } catch (e) { notify((e as Error).message); }
    finally { setLoadingDraft(false); }
  };

  const regenerate = async () => {
    if (!selected) return;
    setLoadingDraft(true);
    try {
      const r = await api<{ draft: Draft }>(`/api/videos/${selected.id}/draft?regen=1`, { method: "POST" });
      setDraft(r.draft); setComment(r.draft.comment);
    } catch (e) { notify((e as Error).message); }
    finally { setLoadingDraft(false); }
  };

  const addByLink = async (url: string) => {
    setLoadingVideos(true);
    try {
      const r = await api<{ video: VideoRow; draft: Draft }>("/api/videos", { method: "POST", body: JSON.stringify({ url }) });
      setVideos((vs) => [r.video, ...vs.filter((v) => v.id !== r.video.id)]);
      setSelected(r.video); setDraft(r.draft); setComment(r.draft.comment);
    } catch (e) { notify((e as Error).message); }
    finally { setLoadingVideos(false); }
  };

  const post = async () => {
    if (!selected) return;
    try {
      const r = await api<{ job: Job }>("/api/jobs", {
        method: "POST", body: JSON.stringify({ videoId: selected.id, comment, profile: profileChoice || null }),
      });
      setJob(r.job);
    } catch (e) { notify((e as Error).message); }
  };

  const abort = async () => { if (job) { await api(`/api/jobs/${job.id}`, { method: "DELETE" }).catch(() => {}); } };

  const profileAction = async (name: string, action: "check" | "login") => {
    try {
      const r = await api<{ logged_in?: boolean; note?: string }>("/api/profiles", { method: "POST", body: JSON.stringify({ name, action }) });
      notify(r.note ?? (r.logged_in ? `${name}: 로그인됨` : `${name}: 로그인 필요`));
      await refreshProfiles();
    } catch (e) { notify((e as Error).message); }
  };

  const jobRunning = !!job && job.status !== "done" && job.status !== "failed";

  return (
    <main className="mx-auto flex max-w-[1500px] flex-col gap-5 px-6 py-5">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight">유튜브 댓글 에이전트</h1>
        <p className="rounded-full border border-line bg-white px-3 py-1 text-xs text-muted">오늘 게시 <b className="text-ink">{logState.today_success}</b> / {logState.daily_max} · 영상당 댓글 1개</p>
      </header>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <VideoColumn mode={mode} videos={videos} loading={loadingVideos} selectedId={selected?.id ?? null}
          onLoad={loadVideos} onSelect={selectVideo} onAddLink={addByLink} />
        <DraftColumn video={selected} draft={draft} comment={comment} loading={loadingDraft}
          onChange={setComment} onRegenerate={regenerate} />
        <PostColumn video={selected} draft={draft} comment={comment} profiles={profiles} autoProfile={autoProfile}
          profileChoice={profileChoice} onProfileChoice={setProfileChoice} job={job} running={jobRunning}
          onPost={post} onAbort={abort} onProfileAction={profileAction} />
      </div>
      <LogPanel rows={logState.log} />
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </main>
  );
}
