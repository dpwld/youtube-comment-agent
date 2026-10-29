/**
 * 운영 규칙이 코드에서 강제되는지 확인한다 (브라우저·API 호출 없음, 임시 데이터 폴더 사용).
 *   npm test
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.YT_AGENT_DATA_DIR = mkdtempSync(path.join(tmpdir(), "yt-agent-test-"));

let store: typeof import("../lib/store");
let draft: typeof import("../lib/draft");
let config: typeof import("../lib/config");

const OK = "남친 생일에 친구 결혼식 겹친 장면 보는데 내 얘기 같아서 웃펐다ㅠㅠ 운명원 연애사주가 잘 본다던데 나도 이 사람이 맞는지 한번 보고 싶다";

function finish(jobId: string, videoId: string, comment: string) {
  store.updateJob(jobId, { status: "done" });
  store.logComment({ video_id: videoId, video_title: videoId, profile: "유튜브1", comment, ok: 1, reason: null, job_id: jobId });
}

function code(fn: () => unknown): string {
  try { fn(); } catch (e) { return (e as { code: string }).code; }
  return "OK";
}

before(async () => {
  config = await import("../lib/config");
  store = await import("../lib/store");
  draft = await import("../lib/draft");
});

test("영상당 댓글 1개: 같은 영상에 두 번째 댓글은 409 ALREADY_COMMENTED", () => {
  const job = store.reserveJob("video-A", "유튜브1", OK);
  finish(job.id, "video-A", OK);
  assert.equal(code(() => store.reserveJob("video-A", "유튜브2", OK + "!")), "ALREADY_COMMENTED");
});

test("영상마다 다르게: 다른 영상에 같은 댓글은 409 DUPLICATE_COMMENT", () => {
  assert.equal(code(() => store.reserveJob("video-B", "유튜브2", OK)), "DUPLICATE_COMMENT");
});

test("한 번에 하나: 진행 중인 작업이 있으면 409 BUSY", () => {
  const job = store.reserveJob("video-B", "유튜브2", OK + " 1");
  assert.equal(code(() => store.reserveJob("video-C", "유튜브3", OK + " 2")), "BUSY");
  finish(job.id, "video-B", OK + " 1");
});

test("하루 게시 상한: 오늘 상한에 도달하면 429 DAILY_CAP", () => {
  config.loadConfig().limits.daily_max_comments = 3; // 기본 10개를 테스트용으로 낮춤 (오늘 2개 게시됨)
  const job = store.reserveJob("video-C", "유튜브3", OK + " 3");
  finish(job.id, "video-C", OK + " 3");
  assert.equal(code(() => store.reserveJob("video-D", "유튜브1", OK + " 4")), "DAILY_CAP");
});

test("기록: 어느 영상에 · 어느 프로필로 · 무슨 댓글을 · 성공/실패가 시간순으로 남는다", () => {
  const log = store.listLog();
  assert.deepEqual(log.map((r) => r.video_id), ["video-C", "video-B", "video-A"]);
  assert.ok(log.every((r) => r.profile && r.comment && r.ok === 1));
});

test("댓글 규칙: 40~120자 · 링크 · 해시태그 · 지어낸 후기 · 운명원 1회", () => {
  assert.deepEqual(draft.validateComment(OK), []);
  assert.match(draft.validateComment("너무 짧다 운명원").join(), /길이/);
  assert.match(draft.validateComment(OK + " https://a.kr").join(), /링크/);
  assert.match(draft.validateComment(OK + " #연애").join(), /해시태그/);
  assert.match(draft.validateComment("영상 속 결혼식 장면 공감ㅠㅠ 나 지난주에 운명원에서 봤는데 진짜 소름 돋게 맞더라 다들 한번 가봐 진짜 추천").join(), /후기/);
  assert.match(draft.validateComment(OK.replace("운명원", "사주")).join(), /정확히 1회/);
});
