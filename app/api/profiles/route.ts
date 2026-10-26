import { errorResponse } from "@/lib/api";
import { isLoggedIn, openProfile, waitForLoginOrClose } from "@/lib/browser";
import { listProfiles, pickProfile, setProfileState } from "@/lib/store";

export async function GET() {
  return Response.json({ profiles: listProfiles(), auto: pickProfile() });
}

/** POST {name, action:'check'|'login'} */
export async function POST(req: Request) {
  try {
    const { name, action } = (await req.json()) as { name: string; action: "check" | "login" };
    if (!listProfiles().some((p) => p.name === name)) return Response.json({ error: "BAD_PROFILE", message: "없는 프로필" }, { status: 400 });
    const context = await openProfile(name);
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      if (action === "login") {
        await page.goto("https://accounts.google.com/ServiceLogin?continue=https://www.youtube.com/&hl=ko");
        const result = await waitForLoginOrClose(context); // 사람이 로그인할 때까지
        if (result === "logged_in") { setProfileState(name, true); await page.waitForTimeout(2000); }
        return Response.json({ ok: true, logged_in: result === "logged_in", note: result === "logged_in" ? `${name}: 로그인 확인됨` : `${name}: 창이 닫혔어요. 상태 확인으로 검사하세요.` });
      }
      await page.goto("https://www.youtube.com/?hl=ko", { waitUntil: "domcontentloaded" });
      const logged = await isLoggedIn(page);
      setProfileState(name, logged);
      return Response.json({ ok: true, logged_in: logged });
    } finally {
      await context.close().catch(() => {});
    }
  } catch (e) {
    return errorResponse(e);
  }
}
