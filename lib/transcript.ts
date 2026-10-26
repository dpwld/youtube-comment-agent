import { YoutubeTranscript } from "youtube-transcript";
import type { Video } from "./store";

export type TranscriptResult = { text: string; source: "자막(ko)" | "자막(auto)" | "제목·설명"; chars: number };

const MAX_CHARS = 150_000; // 이보다 길면 전 구간에서 고르게 표본 추출
const MARK_EVERY_S = 30;

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** 자막을 [m:ss] 시간 표시가 섞인 한 덩어리 텍스트로. 긴 영상도 처음부터 끝까지 담는다. */
function withTimestamps(items: { text: string; offset: number }[]): string {
  const parts: string[] = [];
  let nextMark = 0;
  for (const it of items) {
    const sec = it.offset / 1000;
    if (sec >= nextMark) { parts.push(`[${mmss(sec)}]`); nextMark = sec + MARK_EVERY_S; }
    parts.push(it.text.replace(/\s+/g, " ").trim());
  }
  let text = parts.join(" ");
  if (text.length > MAX_CHARS) {
    // 앞 1/3, 가운데 1/3, 뒤 1/3 에서 고르게
    const slice = Math.floor(MAX_CHARS / 3);
    const mid = Math.floor(text.length / 2);
    text = `${text.slice(0, slice)} … (중략) … ${text.slice(mid - slice / 2, mid + slice / 2)} … (중략) … ${text.slice(-slice)}`;
  }
  return text;
}

export async function getTranscript(video: Video): Promise<TranscriptResult> {
  for (const lang of ["ko", undefined] as const) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(video.id, lang ? { lang } : undefined);
      const text = withTimestamps(items);
      if (text.length > 50) return { text, source: lang ? "자막(ko)" : "자막(auto)", chars: text.length };
    } catch {
      // 다음 후보로
    }
  }
  const text = `${video.title}\n\n${video.description}`;
  return { text, source: "제목·설명", chars: text.length };
}
