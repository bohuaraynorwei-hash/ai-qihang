import { checkAdmin, checkCron, deny, json, jsonError } from "@/lib/auth";
import { runProofread } from "@/lib/proofread";
import { getConfig } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 自动纠错入口
 * - GET  ?secret=xxx        给系统 crontab / Vercel Cron 用（每天跑一次校对）
 * - POST {} (需要管理密码)   管理台手动触发，可指定条数 / 条目 / force
 */
export async function GET(request: Request) {
  const auth = checkCron(request);
  if (!auth.ok) return deny(auth);
  return await run(request, {});
}

export async function POST(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);

  let body: { limit?: number; itemIds?: unknown; force?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* 允许空 body */
  }

  return await run(request, {
    limit: typeof body.limit === "number" ? body.limit : undefined,
    itemIds: Array.isArray(body.itemIds)
      ? body.itemIds.filter((x): x is string => typeof x === "string").slice(0, 50)
      : undefined,
    force: Boolean(body.force),
  });
}

async function run(
  _request: Request,
  options: { limit?: number; itemIds?: string[]; force?: boolean }
) {
  try {
    const config = await getConfig();
    const report = await runProofread(config, options);
    return json({ ok: true, report });
  } catch (err) {
    console.error("[proofread] 失败:", err);
    return jsonError(500, err instanceof Error ? err.message : "自动纠错失败");
  }
}
