import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { profileDir } from "./config";

const CHROME_PLIST = "/Applications/Google Chrome.app/Contents/Info.plist";

/** 설치된 Chrome 버전으로 만든 일반 UA (HeadlessChrome 표기 방지). */
function chromeUserAgent(): string | undefined {
  try {
    const m = /<key>CFBundleShortVersionString<\/key>\s*<string>(\d+)/.exec(readFileSync(CHROME_PLIST, "utf8"));
    if (!m) return undefined;
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${m[1]}.0.0.0 Safari/537.36`;
  } catch {
    return undefined;
  }
}

type Registry = { openProfiles: Set<string> };
const g = globalThis as unknown as { __ytAgentBrowser?: Registry };
const registry: Registry = (g.__ytAgentBrowser ??= { openProfiles: new Set() });

/** 프로필 폴더를 persistent context 로 연다. 같은 프로필 동시 오픈은 거부. */
export async function openProfile(name: string, opts: { headless?: boolean } = {}): Promise<BrowserContext> {
  if (registry.openProfiles.has(name)) throw new Error(`PROFILE_BUSY: ${name} 프로필이 이미 열려 있습니다`);
  const dir = profileDir(name);
  mkdirSync(dir, { recursive: true });
  registry.openProfiles.add(name);
  try {
    const userAgent = chromeUserAgent();
    const context = await chromium.launchPersistentContext(dir, {
      channel: "chrome",
      headless: opts.headless ?? false,
      viewport: { width: 1280, height: 900 },
      locale: "ko-KR",
      args: ["--disable-blink-features=AutomationControlled", "--lang=ko-KR"],
      ignoreDefaultArgs: ["--enable-automation"],
      ...(userAgent ? { userAgent } : {}),
    });
    context.setDefaultTimeout(30_000);
    context.on("close", () => registry.openProfiles.delete(name));
    return context;
  } catch (e) {
    registry.openProfiles.delete(name);
    throw e;
  }
}

export function isProfileOpen(name: string): boolean {
  return registry.openProfiles.has(name);
}

/** 유튜브 마스트헤드에서 로그인 여부 판정. */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const avatar = page.locator("ytd-masthead #avatar-btn");
  const signIn = page.locator('ytd-masthead a[aria-label="로그인"], ytd-masthead a[href*="ServiceLogin"]');
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await avatar.first().isVisible().catch(() => false)) return true;
    if (await signIn.first().isVisible().catch(() => false)) return false;
    await page.waitForTimeout(500);
  }
  return false;
}

/** 창이 모두 닫힐 때까지 대기 (수동 로그인용). */
export function waitForClose(context: BrowserContext): Promise<void> {
  return new Promise((resolve) => {
    const check = () => { if (context.pages().length === 0) resolve(); };
    context.on("close", () => resolve());
    for (const p of context.pages()) p.on("close", check);
    context.on("page", (p) => p.on("close", check));
  });
}
