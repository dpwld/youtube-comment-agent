/**
 * 셀렉터 스파이크: npx tsx scripts/spike.ts 유튜브1 <videoId> "댓글 텍스트"
 * 텍스트를 생략하면 게시하지 않고 DOM 구조만 덤프한다 (로그인 없이도 가능).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openProfile, isLoggedIn } from "../lib/browser";
import { postComment } from "../lib/poster";
import { dataDir } from "../lib/config";

async function main() {
  const [name, videoId, text] = process.argv.slice(2);
  if (!name || !videoId) {
    console.error('usage: npx tsx scripts/spike.ts <profile> <videoId> ["text"]');
    process.exit(1);
  }
  const context = await openProfile(name);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: "domcontentloaded" });
  console.log("logged in:", await isLoggedIn(page));

  const dumpDir = path.join(dataDir(), "spike");
  mkdirSync(dumpDir, { recursive: true });
  const dump = async (label: string, selector: string) => {
    const html = await page.locator(selector).first().evaluate((el) => el.outerHTML).catch((e) => `ERR ${e.message}`);
    writeFileSync(path.join(dumpDir, `${label}.html`), html);
    console.log(`dumped ${label}: ${html.length} chars`);
  };

  if (text) {
    const result = await postComment(page, text, (step, detail) => console.log(`[${step}] ${detail ?? ""}`));
    console.log("result:", result);
  } else {
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(500);
      if (await page.locator("ytd-comment-simplebox-renderer").first().isVisible().catch(() => false)) break;
    }
    await page.waitForTimeout(2000);
    await dump("simplebox", "ytd-comment-simplebox-renderer");
    await dump("thread", "ytd-comment-thread-renderer");
    await dump("masthead-end", "ytd-masthead #end");
  }
  await page.screenshot({ path: path.join(dumpDir, "spike.png") });
  await context.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
