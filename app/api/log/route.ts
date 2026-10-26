import { loadConfig } from "@/lib/config";
import { listLog, todayCount, todaySuccessCount } from "@/lib/store";

export async function GET() {
  const cfg = loadConfig();
  return Response.json({ log: listLog(), today: todayCount(), today_success: todaySuccessCount(), daily_max: cfg.limits.daily_max_comments });
}
