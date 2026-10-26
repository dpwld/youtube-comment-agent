import type { Page } from "playwright";

/** 유튜브 한국어 UI 셀렉터 — 스파이크(scripts/spike.ts)로 검증 후 여기만 고친다. */
export const SEL = {
  watch: "ytd-watch-flexy",
  commentsDisabled: 'ytd-comments ytd-message-renderer:has-text("댓글이 사용 중지")',
  simplebox: "ytd-comments ytd-comment-simplebox-renderer",
  placeholder: "ytd-comments ytd-comment-simplebox-renderer #placeholder-area",
  editor: 'ytd-comments ytd-comment-simplebox-renderer #contenteditable-root[contenteditable="true"]',
  submit: "ytd-comments ytd-comment-simplebox-renderer #submit-button button",
  thread: "ytd-comments ytd-comment-thread-renderer",
  threadText: "#content-text",
  threadTime: "#published-time-text a",
  toast: "tp-yt-paper-toast, yt-notification-action-renderer",
  dialogDismiss: [
    'ytd-consent-bump-v2-lightbox button:has-text("모두 수락")',
    'tp-yt-paper-dialog button:has-text("건너뛰기")',
    'tp-yt-paper-dialog button:has-text("나중에")',
    "tp-yt-paper-dialog #dismiss-button",
  ],
} as const;

export type PostStep =
  | "navigating" | "finding_box" | "typing" | "posting" | "verifying" | "done";
export type PostResult =
  | { ok: true; commentUrl: string | null }
  | { ok: false; code: string; message: string };

export class PostError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** 이미 영상 페이지에 있는 page 에서 댓글을 한 글자씩 입력·게시·확인한다. */
export async function postComment(
  page: Page,
  text: string,
  onStep: (step: PostStep, detail?: string) => void,
): Promise<PostResult> {
  try {
    onStep("navigating");
    await page.locator(SEL.watch).first().waitFor({ state: "attached", timeout: 30_000 });
    await page.keyboard.press("k").catch(() => {}); // 영상 일시정지
    for (const sel of SEL.dialogDismiss) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) await btn.click().catch(() => {});
    }

    onStep("finding_box");
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      if (await page.locator(SEL.commentsDisabled).first().isVisible().catch(() => false))
        throw new PostError("COMMENTS_DISABLED", "이 영상은 댓글이 사용 중지되어 있습니다");
      if (await page.locator(SEL.placeholder).first().isVisible().catch(() => false)) break;
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(600);
    }
    const placeholder = page.locator(SEL.placeholder).first();
    if (!(await placeholder.isVisible().catch(() => false)))
      throw new PostError("NO_COMMENT_BOX", "댓글창을 찾지 못했습니다");
    await placeholder.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, -200);
    await placeholder.click();
    const editor = page.locator(SEL.editor).first();
    await editor.waitFor({ state: "visible", timeout: 5_000 });
    await editor.click();

    onStep("typing", `0/${[...text].length}`);
    for (let attempt = 0; attempt < 2; attempt++) {
      const chars = [...text];
      for (let i = 0; i < chars.length; i++) {
        await editor.pressSequentially(chars[i], { delay: rand(60, 130) });
        if ((i + 1) % 10 === 0) onStep("typing", `${i + 1}/${chars.length}`);
      }
      const typed = norm(await editor.innerText());
      if (typed === norm(text)) break;
      if (attempt === 1) throw new PostError("TYPING_MISMATCH", "입력된 텍스트가 초안과 다릅니다");
      await editor.press("Meta+a");
      await editor.press("Backspace");
    }
    onStep("typing", `${[...text].length}/${[...text].length}`);

    onStep("posting");
    const submit = page.locator(SEL.submit).first();
    await submit.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForFunction(
      (sel) => { const b = document.querySelector(sel) as HTMLButtonElement | null; return !!b && !b.disabled && b.getAttribute("aria-disabled") !== "true"; },
      SEL.submit, { timeout: 10_000 },
    );
    await submit.click();

    onStep("verifying");
    const want = norm(text);
    const head = want.slice(0, 30);
    const verifyDeadline = Date.now() + 30_000;
    while (Date.now() < verifyDeadline) {
      const toast = page.locator(SEL.toast).first();
      if (await toast.isVisible().catch(() => false)) {
        const t = norm(await toast.innerText().catch(() => ""));
        if (/오류|게시할 수 없|실패/.test(t)) throw new PostError("POST_REJECTED", `유튜브 오류: ${t}`);
      }
      const threads = page.locator(SEL.thread);
      const n = Math.min(await threads.count(), 5);
      for (let i = 0; i < n; i++) {
        const th = threads.nth(i);
        const t = norm(await th.locator(SEL.threadText).first().innerText().catch(() => ""));
        if (t === want || (head.length >= 10 && t.startsWith(head))) {
          const href = await th.locator(SEL.threadTime).first().getAttribute("href").catch(() => null);
          const commentUrl = href ? new URL(href, "https://www.youtube.com").toString() : null;
          await th.scrollIntoViewIfNeeded().catch(() => {});
          onStep("done");
          return { ok: true, commentUrl };
        }
      }
      await page.waitForTimeout(1_000);
    }
    throw new PostError("NOT_VISIBLE", "게시 후 30초 안에 내 댓글이 보이지 않습니다 (검토 보류 가능성)");
  } catch (e) {
    if (e instanceof PostError) return { ok: false, code: e.code, message: e.message };
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "UNEXPECTED", message: msg.split("\n")[0] };
  }
}
