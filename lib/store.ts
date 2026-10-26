import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { dataDir, loadConfig } from "./config";

export type Video = {
  id: string; title: string; channel: string; published_at: string; thumbnail: string;
  description: string; view_count: number; source: "latest" | "rising" | "link"; fetched_at: string;
  views_per_hour?: number; rising?: boolean;
};
export type Draft = {
  video_id: string; summary: string; worry: string; scene_ref: string; comment: string; transcript_source: string;
  valid: number; violations: string; attempts: number; created_at: string;
};
export type JobStatus =
  | "queued" | "opening_profile" | "navigating" | "finding_box" | "typing" | "posting" | "verifying" | "done" | "failed";
export type Job = {
  id: string; video_id: string; profile: string; comment: string; status: JobStatus; step_detail: string | null;
  error: string | null; screenshot_path: string | null; comment_url: string | null; day: string;
  created_at: string; updated_at: string;
};
export type LogRow = {
  id: number; ts: string; day: string; video_id: string; video_title: string; profile: string;
  comment: string; ok: number; reason: string | null; job_id: string | null;
};

export class RuleError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

const ACTIVE = `('queued','opening_profile','navigating','finding_box','typing','posting','verifying')`;

/** Asia/Seoul 기준 YYYY-MM-DD */
export function kstDay(d = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(d);
}
const now = () => new Date().toISOString();

const SCHEMA = `
PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY, title TEXT, channel TEXT, published_at TEXT, thumbnail TEXT,
  description TEXT, view_count INTEGER, source TEXT, fetched_at TEXT);
CREATE TABLE IF NOT EXISTS drafts (video_id TEXT PRIMARY KEY, worry TEXT, scene_ref TEXT, comment TEXT, transcript_source TEXT,
  valid INTEGER, violations TEXT, attempts INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS profiles (name TEXT PRIMARY KEY, logged_in INTEGER, checked_at TEXT);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, video_id TEXT, profile TEXT, comment TEXT, status TEXT, step_detail TEXT,
  error TEXT, screenshot_path TEXT, comment_url TEXT, day TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS comment_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, day TEXT, video_id TEXT, video_title TEXT,
  profile TEXT, comment TEXT, ok INTEGER, reason TEXT, job_id TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS ul_one_per_video ON comment_log(video_id) WHERE ok = 1;
CREATE UNIQUE INDEX IF NOT EXISTS uj_one_active ON jobs(video_id) WHERE status IN ${ACTIVE};
`;

const g = globalThis as unknown as { __ytAgentDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__ytAgentDb) return g.__ytAgentDb;
  mkdirSync(dataDir(), { recursive: true });
  const d = new DatabaseSync(path.join(dataDir(), "agent.sqlite"));
  d.exec(SCHEMA);
  // 서버 재시작으로 끊긴 작업 정리
  const stale = d.prepare(`SELECT id, video_id, profile, comment FROM jobs WHERE status IN ${ACTIVE}`).all() as Pick<Job, "id" | "video_id" | "profile" | "comment">[];
  for (const j of stale) {
    d.prepare(`UPDATE jobs SET status='failed', error='서버 재시작으로 중단됨', updated_at=? WHERE id=?`).run(now(), j.id);
    const v = d.prepare(`SELECT title FROM videos WHERE id=?`).get(j.video_id) as { title: string } | undefined;
    d.prepare(`INSERT INTO comment_log (ts, day, video_id, video_title, profile, comment, ok, reason, job_id) VALUES (?,?,?,?,?,?,0,?,?)`)
      .run(now(), kstDay(), j.video_id, v?.title ?? "", j.profile, j.comment, "서버 재시작으로 중단됨", j.id);
  }
  try { d.exec("ALTER TABLE drafts ADD COLUMN summary TEXT"); } catch { /* 이미 있음 */ }
  g.__ytAgentDb = d;
  return d;
}

// ---- videos ----
export function upsertVideos(list: Video[]): void {
  const stmt = db().prepare(`INSERT INTO videos (id,title,channel,published_at,thumbnail,description,view_count,source,fetched_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, channel=excluded.channel, published_at=excluded.published_at,
    thumbnail=excluded.thumbnail, description=excluded.description, view_count=excluded.view_count, source=excluded.source, fetched_at=excluded.fetched_at`);
  for (const v of list) stmt.run(v.id, v.title, v.channel, v.published_at, v.thumbnail, v.description, v.view_count, v.source, v.fetched_at);
}
export function getVideo(id: string): Video | null {
  return (db().prepare(`SELECT * FROM videos WHERE id=?`).get(id) as Video | undefined) ?? null;
}
export function listVideos(source: Video["source"]): Video[] {
  return db().prepare(`SELECT * FROM videos WHERE source=? ORDER BY published_at DESC`).all(source) as unknown as Video[];
}
export function latestFetchedAt(source: Video["source"]): string | null {
  const r = db().prepare(`SELECT MAX(fetched_at) AS t FROM videos WHERE source=?`).get(source) as { t: string | null };
  return r?.t ?? null;
}

// ---- drafts ----
export function saveDraft(d: Draft): void {
  db().prepare(`INSERT INTO drafts (video_id,summary,worry,scene_ref,comment,transcript_source,valid,violations,attempts,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(video_id) DO UPDATE SET summary=excluded.summary, worry=excluded.worry, scene_ref=excluded.scene_ref, comment=excluded.comment,
    transcript_source=excluded.transcript_source, valid=excluded.valid, violations=excluded.violations, attempts=excluded.attempts, created_at=excluded.created_at`)
    .run(d.video_id, d.summary, d.worry, d.scene_ref, d.comment, d.transcript_source, d.valid, d.violations, d.attempts, d.created_at);
}
export function getDraft(videoId: string): Draft | null {
  return (db().prepare(`SELECT * FROM drafts WHERE video_id=?`).get(videoId) as Draft | undefined) ?? null;
}

// ---- profiles ----
export function setProfileState(name: string, loggedIn: boolean): void {
  db().prepare(`INSERT INTO profiles (name, logged_in, checked_at) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET logged_in=excluded.logged_in, checked_at=excluded.checked_at`)
    .run(name, loggedIn ? 1 : 0, now());
}
export type ProfileInfo = { name: string; logged_in: boolean | null; checked_at: string | null; last_used: string | null; today_count: number };
export function listProfiles(): ProfileInfo[] {
  const cfg = loadConfig();
  const day = kstDay();
  return cfg.profiles.map((name) => {
    const p = db().prepare(`SELECT logged_in, checked_at FROM profiles WHERE name=?`).get(name) as { logged_in: number; checked_at: string } | undefined;
    const u = db().prepare(`SELECT MAX(ts) AS t FROM comment_log WHERE profile=?`).get(name) as { t: string | null };
    const c = db().prepare(`SELECT COUNT(*) AS n FROM comment_log WHERE profile=? AND day=? AND ok=1`).get(name, day) as { n: number };
    return { name, logged_in: p ? p.logged_in === 1 : null, checked_at: p?.checked_at ?? null, last_used: u.t, today_count: c.n };
  });
}
/** 자동 배정: 로그인된(또는 미확인) 프로필 중 가장 오래 전에 쓴 것 (미사용 우선). */
export function pickProfile(): string | null {
  const candidates = listProfiles().filter((p) => p.logged_in !== false);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.last_used ?? "").localeCompare(b.last_used ?? ""));
  return candidates[0].name;
}

// ---- jobs ----
export function todayCount(): number {
  const r = db().prepare(`SELECT COUNT(*) AS n FROM jobs WHERE day=? AND status!='failed'`).get(kstDay()) as { n: number };
  return r.n;
}
export function activeJob(): Job | null {
  return (db().prepare(`SELECT * FROM jobs WHERE status IN ${ACTIVE} ORDER BY created_at DESC LIMIT 1`).get() as Job | undefined) ?? null;
}
export function getJob(id: string): Job | null {
  return (db().prepare(`SELECT * FROM jobs WHERE id=?`).get(id) as Job | undefined) ?? null;
}
export function hasCommented(videoId: string): boolean {
  return !!db().prepare(`SELECT 1 FROM comment_log WHERE video_id=? AND ok=1`).get(videoId);
}
/** 운영 규칙은 전부 여기서 강제한다 (영상당 1개 · 한 번에 하나 · 일일 상한). */
export function reserveJob(videoId: string, profile: string, comment: string): Job {
  const d = db();
  const cfg = loadConfig();
  d.exec("BEGIN IMMEDIATE");
  try {
    if (hasCommented(videoId)) throw new RuleError("ALREADY_COMMENTED", "이미 댓글을 단 영상이에요 (영상당 1개)", 409);
    if (activeJob()) throw new RuleError("BUSY", "다른 댓글 작업이 진행 중이에요. 끝난 뒤 다시 눌러 주세요", 409);
    const n = todayCount();
    if (n >= cfg.limits.daily_max_comments) throw new RuleError("DAILY_CAP", `오늘 게시 상한(${cfg.limits.daily_max_comments}개)에 도달했어요`, 429);
    const job: Job = {
      id: randomUUID(), video_id: videoId, profile, comment, status: "queued", step_detail: null, error: null,
      screenshot_path: null, comment_url: null, day: kstDay(), created_at: now(), updated_at: now(),
    };
    d.prepare(`INSERT INTO jobs (id,video_id,profile,comment,status,step_detail,error,screenshot_path,comment_url,day,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(job.id, job.video_id, job.profile, job.comment, job.status, null, null, null, null, job.day, job.created_at, job.updated_at);
    d.exec("COMMIT");
    return job;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
export function updateJob(id: string, patch: Partial<Pick<Job, "status" | "step_detail" | "error" | "screenshot_path" | "comment_url">>): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k}=?`).join(", ");
  db().prepare(`UPDATE jobs SET ${sets}, updated_at=? WHERE id=?`).run(...keys.map((k) => patch[k] ?? null), now(), id);
}

// ---- log ----
export function logComment(row: Omit<LogRow, "id" | "ts" | "day">): void {
  db().prepare(`INSERT INTO comment_log (ts, day, video_id, video_title, profile, comment, ok, reason, job_id) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(now(), kstDay(), row.video_id, row.video_title, row.profile, row.comment, row.ok, row.reason, row.job_id);
}
export function listLog(limit = 100): LogRow[] {
  return db().prepare(`SELECT * FROM comment_log ORDER BY ts DESC LIMIT ?`).all(limit) as unknown as LogRow[];
}
export function todaySuccessCount(): number {
  const r = db().prepare(`SELECT COUNT(*) AS n FROM comment_log WHERE day=? AND ok=1`).get(kstDay()) as { n: number };
  return r.n;
}
