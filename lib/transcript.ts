import { YoutubeTranscript } from "youtube-transcript";
import type { Video } from "./store";

export type TranscriptResult = { text: string; source: "자막(ko)" | "자막(auto)" | "제목·설명" };

const MAX = 8000;

export async function getTranscript(video: Video): Promise<TranscriptResult> {
  for (const lang of ["ko", undefined] as const) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(video.id, lang ? { lang } : undefined);
      const text = items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
      if (text.length > 50) return { text: text.slice(0, MAX), source: lang ? "자막(ko)" : "자막(auto)" };
    } catch {
      // 다음 후보로
    }
  }
  return { text: `${video.title}\n\n${video.description}`.slice(0, MAX), source: "제목·설명" };
}
