import { openProfile, waitForLoginOrClose } from "../lib/browser";
async function main() {
  const [profile, url] = process.argv.slice(2);
  const ctx = await openProfile(profile);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  console.log("opened", profile, url);
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline && ctx.pages().length > 0) await new Promise((r) => setTimeout(r, 1500));
  await ctx.close().catch(() => {});
}
main().catch((e) => { console.error(e.message?.split("\n")[0]); process.exit(1); });
