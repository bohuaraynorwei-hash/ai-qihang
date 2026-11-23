import { checkCron, deny, json, jsonError } from "@/lib/auth";
import { crawlWithConfig } from "@/lib/crawler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron 每天调用一次：vercel.json 里的 crons 配置。
 * 也可以在管理台手动 POST /api/crawl。
 */
export async function GET(request: Request) {
  const auth = checkCron(request);
  if (!auth.ok) return deny(auth);

  try {
    const report = await crawlWithConfig();
    return json({ ok: true, report });
  } catch (err) {
    console.error("[cron] 抓取失败:", err);
    return jsonError(500, err instanceof Error ? err.message : "抓取失败");
  }
}
