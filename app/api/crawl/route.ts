import { checkAdmin, deny, json, jsonError } from "@/lib/auth";
import { crawlWithConfig } from "@/lib/crawler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 管理台手动触发抓取（需要 x-admin-password 请求头） */
export async function POST(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);

  let body: { sourceIds?: unknown; maxItems?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* 允许空 body */
  }

  const sourceIds = Array.isArray(body.sourceIds)
    ? body.sourceIds.filter((x): x is string => typeof x === "string").slice(0, 30)
    : undefined;
  const maxItems = typeof body.maxItems === "number" ? body.maxItems : undefined;

  try {
    const report = await crawlWithConfig({ sourceIds, maxItems });
    return json({ ok: true, report });
  } catch (err) {
    console.error("[api/crawl] 失败:", err);
    return jsonError(500, err instanceof Error ? err.message : "抓取失败");
  }
}

export async function GET() {
  return jsonError(405, "请用 POST 触发抓取（需要管理密码）");
}
