/**
 * 수동 로그인: npx tsx scripts/login.ts 유튜브1
 * 해당 프로필로 Chrome 을 열어 구글 로그인 화면을 띄운다. 사람이 직접 로그인하고 창을 닫으면 종료.
 * 봇은 아무것도 입력하지 않는다.
 */
import { loadConfig, profileDir } from "../lib/config";
import { openProfile, waitForClose } from "../lib/browser";

async function main() {
  const name = process.argv[2];
  const cfg = loadConfig();
  if (!name || !cfg.profiles.includes(name)) {
    console.error(`usage: npx tsx scripts/login.ts <${cfg.profiles.join("|")}>`);
    process.exit(1);
  }
  const context = await openProfile(name);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://accounts.google.com/ServiceLogin?continue=https://www.youtube.com/&hl=ko");
  console.log(`[${name}] 구글 로그인 후 유튜브가 뜨면 창을 닫으세요. 세션은 ${profileDir(name)} 에 저장됩니다.`);
  console.log(`구글이 로그인을 막으면: open -na "Google Chrome" --args --user-data-dir="${profileDir(name)}" 로 직접 로그인하세요.`);
  await waitForClose(context);
  await context.close().catch(() => {});
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
