import type { Video } from "./store";

const API = "https://www.googleapis.com/youtube/v3";

function key(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY 가 .env.local 에 없습니다");
  return k;
}

async function call<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: key() })) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API ${endpoint} ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

type SearchItem = { id: { videoId?: string } };
type VideoItem = {
  id: string;
  snippet: { title: string; channelTitle: string; publishedAt: string; description: string; thumbnails: Record<string, { url: string }> };
  statistics?: { viewCount?: string };
};

export async function searchVideoIds(q: string, opts: { max: number; publishedAfter?: string }): Promise<string[]> {
  const r = await call<{ items: SearchItem[] }>("search", {
    part: "id", q, type: "video", order: "date", regionCode: "KR", relevanceLanguage: "ko",
    maxResults: String(Math.min(opts.max, 50)), ...(opts.publishedAfter ? { publishedAfter: opts.publishedAfter } : {}),
  });
  return r.items.map((i) => i.id.videoId).filter((v): v is string => !!v);
}

export async function getVideos(ids: string[], source: Video["source"]): Promise<Video[]> {
  if (ids.length === 0) return [];
  const r = await call<{ items: VideoItem[] }>("videos", { part: "snippet,statistics", id: ids.join(","), hl: "ko" });
  const fetched_at = new Date().toISOString();
  return r.items.map((it) => {
    const t = it.snippet.thumbnails;
    const v: Video = {
      id: it.id, title: it.snippet.title, channel: it.snippet.channelTitle, published_at: it.snippet.publishedAt,
      thumbnail: (t.medium ?? t.high ?? t.default)?.url ?? "", description: it.snippet.description ?? "",
      view_count: Number(it.statistics?.viewCount ?? 0), source, fetched_at,
    };
    return withRising(v);
  });
}

/** '뜨기 직전': 조회수 1,000~5,000 이고 시간당 150 이상 */
export function withRising(v: Video): Video {
  const hours = Math.max((Date.now() - new Date(v.published_at).getTime()) / 3.6e6, 1);
  const vph = v.view_count / hours;
  return { ...v, views_per_hour: Math.round(vph), rising: v.view_count >= 1000 && v.view_count <= 5000 && vph >= 150 };
}

export async function getTopComments(videoId: string, max = 5): Promise<string[]> {
  try {
    const r = await call<{ items: { snippet: { topLevelComment: { snippet: { textOriginal: string } } } }[] }>("commentThreads", {
      part: "snippet", videoId, order: "relevance", maxResults: String(max), textFormat: "plainText",
    });
    return r.items.map((i) => i.snippet.topLevelComment.snippet.textOriginal.trim()).filter(Boolean);
  } catch {
    return []; // 댓글 비활성(403) 등은 빈 목록
  }
}

export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = /(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([\w-]{11})/.exec(s);
  return m ? m[1] : null;
}
