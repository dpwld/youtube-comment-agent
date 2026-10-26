import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { loadConfig } from "./config";
import type { Draft, Video } from "./store";

const DraftSchema = z.object({
  summary: z.string().describe("영상 전체 내용 요약 3~4문장. 무엇에 대한 영상이고 어떤 고민·사연·결론이 나오는지"),
  key_moments: z.array(z.object({ time: z.string().describe("m:ss"), what: z.string().describe("시청자가 기억할 만한 장면·대사 한 줄") })).min(2).max(5)
    .describe("본론에 해당하는 핵심 장면 2~5개. 인트로 잡담·광고·인사는 제외"),
  worry_one_line: z.string().describe("영상 속 연애 고민을 한 줄로 (60자 이내)"),
  scene_ref: z.string().describe("댓글에서 인용한 장면. key_moments 중 하나여야 하며 시간(m:ss)을 포함"),
  comment: z.string().describe("실제로 달 댓글 본문"),
});
export type DraftOutput = z.infer<typeof DraftSchema>;

const EXAMPLE =
  "근데 진짜 남자심리는 알다가도 모르겠다…ㅠㅠ 맨날 연애하면 차이기만 했던 1인. 결국 심리 알기는 개뿔 그냥 인연이면 만나는 것 같아요. 운명원 연애사주가 그렇게 잘 본다던데 나도 언제 짝 만나지 한번 보고 싶다. 각자 정해진 운명이 있는 듯.";

const len = (s: string) => [...s].length;

/** 서버 측 검증. 위반 목록이 비면 통과. */
export function validateComment(comment: string): string[] {
  const { comment: c } = loadConfig();
  const v: string[] = [];
  const n = len(comment);
  if (n < c.min_chars || n > c.max_chars) v.push(`길이 ${n}자 (허용 ${c.min_chars}~${c.max_chars}자)`);
  if (/https?:\/\/|www\.|\.com|\.kr/i.test(comment)) v.push("링크 포함 금지");
  if (/#/.test(comment)) v.push("해시태그 금지");
  if (/@/.test(comment)) v.push("@ 멘션 금지");
  const brandCount = comment.split(c.brand).length - 1;
  if (brandCount !== 1) v.push(`'${c.brand}' 는 정확히 1회 언급 (현재 ${brandCount}회)`);
  const brand = c.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`${brand}.{0,12}(봤|받았|갔|다녀|해봤|보고 왔|보고왔)`).test(comment) || new RegExp(`(봤|다녀왔|받아봤|보고 왔).{0,6}${brand}`).test(comment))
    v.push("운명원을 직접 이용해 본 것처럼 지어낸 후기 금지");
  return v;
}

function systemPrompt(): string {
  const { comment: c } = loadConfig();
  return `너는 유튜브에서 연애 고민 영상을 끝까지 다 본 평범한 한국인 시청자다. 광고주나 마케터가 아니다.

입력으로 영상의 자막 전문(자동 생성이라 오타·잘못 들린 단어가 섞여 있음)과 [m:ss] 시간 표시, 설명, 인기 댓글이 주어진다.

반드시 이 순서로 생각하고 출력한다:
1. summary — 영상 전체를 처음부터 끝까지 읽고 무슨 영상인지 3~4문장으로 요약한다. 자막 오류는 문맥으로 바로잡아 읽는다.
2. key_moments — 본론에서 시청자가 기억할 만한 장면 2~5개를 시간과 함께 고른다. 인트로 인사·잡담·광고·구독 요청·뜬금없는 단어 하나는 장면이 아니다. 영상의 주제(고민·사연·결론)와 직접 이어진 장면만 고른다.
3. worry_one_line — 영상 속 연애 고민을 한 줄로.
4. scene_ref — 댓글에 쓸 장면 하나를 key_moments 중에서 고른다(시간 포함). 영상의 핵심을 본 사람만 알 수 있는 장면이어야 한다.
5. comment — 댓글.

댓글 규칙:
- ${c.min_chars}~${c.max_chars}자 (공백 포함). 반말·구어체, ㅠㅠ ㅋㅋ 같은 표현 자연스럽게.
- scene_ref 의 장면을 구체적으로 언급해서, 영상 본론을 본 사람만 쓸 수 있는 댓글이어야 한다. 요약(summary)과 무관한 내용은 쓰지 않는다.
- 먼저 그 장면에 진짜 시청자처럼 공감·반응하고, 그 흐름에서 '${c.brand} 연애사주'를 딱 한 번만 자연스럽게 언급해서 읽는 사람도 한번 보고 싶어지게 만든다. ("잘 본다던데", "나도 한번 보고 싶다" 같은 호기심·소망 톤)
- 금지: 링크, 해시태그, @멘션, 광고 문구, 이모지 남발, '${c.brand}에서 봤는데/다녀왔는데' 같은 직접 이용 후기 지어내기, 댓글 안에 시간 표기(m:ss) 쓰기.
- 아래 예시는 톤 참고용이다. 문장을 베끼지 말고 이 영상에 맞게 완전히 새로 써라.
예시: ${EXAMPLE}`;
}

function userContent(video: Video, transcript: { text: string; source: string }, comments: string[]): string {
  return [
    `[제목] ${video.title}`,
    `[채널] ${video.channel}`,
    `[업로드] ${video.published_at.slice(0, 10)}`,
    `[설명] ${video.description.slice(0, 1500)}`,
    comments.length ? `[인기 댓글]\n${comments.map((c, i) => `${i + 1}. ${c.slice(0, 200)}`).join("\n")}` : "[인기 댓글] 없음",
    `[영상 내용 전문 — 출처: ${transcript.source}]\n${transcript.text}`,
  ].join("\n\n");
}

const g = globalThis as unknown as { __anthropic?: Anthropic };
const client = () => (g.__anthropic ??= new Anthropic());

/** 초안 생성 + 검증, 위반 시 사유를 붙여 1회 재생성. */
export async function generateDraft(
  video: Video,
  transcript: { text: string; source: string },
  comments: string[],
): Promise<{ output: DraftOutput; violations: string[]; attempts: number }> {
  const cfg = loadConfig();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent(video, transcript, comments) }];
  let last: { output: DraftOutput; violations: string[] } | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await client().messages.parse({
      model: cfg.model,
      max_tokens: 6000,
      system: systemPrompt(),
      messages,
      output_config: { effort: "medium", format: zodOutputFormat(DraftSchema) },
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error(`초안 생성 실패 (stop_reason=${res.stop_reason})`);
    const output = res.parsed_output;
    output.comment = output.comment.trim();
    const violations = validateComment(output.comment);
    last = { output, violations };
    if (violations.length === 0) return { ...last, attempts: attempt };
    messages.push({ role: "assistant", content: JSON.stringify(output) });
    messages.push({ role: "user", content: `이전 초안이 규칙을 위반했다: ${violations.join(" / ")}. 같은 영상에 대해 규칙을 지켜 다시 써라.` });
  }
  return { ...last!, attempts: 2 };
}

/** 생성 결과를 저장용 행으로. 자막 없이 제목·설명만으로 쓴 초안은 장면 인용을 보장할 수 없어 경고(valid=0)로 표시한다. */
export function toDraftRow(
  videoId: string,
  transcript: { source: string },
  r: { output: DraftOutput; violations: string[]; attempts: number },
): Draft {
  const violations = [...r.violations];
  if (transcript.source === "제목·설명") violations.push("자막이 없어 영상 속 장면을 인용했는지 확인할 수 없음 — 영상을 직접 보고 초안을 고친 뒤 게시하세요");
  return {
    video_id: videoId, summary: r.output.summary, worry: r.output.worry_one_line, scene_ref: r.output.scene_ref, comment: r.output.comment,
    transcript_source: transcript.source, valid: violations.length === 0 ? 1 : 0, violations: violations.join(" / "),
    attempts: r.attempts, created_at: new Date().toISOString(),
  };
}
