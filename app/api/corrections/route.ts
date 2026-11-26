import { json, jsonError } from "@/lib/auth";
import { submitHumanCorrection } from "@/lib/proofread";

export const dynamic = "force-dynamic";

/**
 * 读者提交纠错：不需要登录，但只进待审队列，不会直接改线上内容。
 * 这是故意的——公开写入必须有人把关。
 */
export async function POST(request: Request) {
  let body: {
    itemId?: string;
    field?: string;
    index?: number;
    before?: string;
    after?: string;
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(400, "请求体不是合法 JSON");
  }

  if (!body.itemId || typeof body.itemId !== "string") {
    return jsonError(400, "缺少 itemId");
  }
  const field =
    body.field === "title" || body.field === "summary" || body.field === "point"
      ? body.field
      : "summary";
  const after = (body.after || "").trim();
  if (!after) return jsonError(400, "请填写正确的文本");
  if (after.length > 800) return jsonError(400, "提交内容过长");

  // 极简限流：同一 IP 一小时最多 10 次（内存计数，冷启动会重置，够用）
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!takeToken(ip)) {
    return jsonError(429, "提交太频繁了，请稍后再试");
  }

  try {
    const result = await submitHumanCorrection({
      itemId: body.itemId,
      field,
      index: typeof body.index === "number" ? body.index : undefined,
      before: (body.before || "").trim(),
      after,
      reason: (body.reason || "").trim(),
    });
    if (!result.ok) return jsonError(400, result.message);
    return json({ ok: true, message: result.message });
  } catch (err) {
    console.error("[corrections] 提交失败:", err);
    return jsonError(500, "提交失败，请稍后再试");
  }
}

const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;
const bucketRef = globalThis as unknown as { __aiqihangRate?: Map<string, number[]> };

function takeToken(ip: string): boolean {
  const bucket = (bucketRef.__aiqihangRate ??= new Map());
  const now = Date.now();
  const hits = (bucket.get(ip) ?? []).filter((t: number) => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) {
    bucket.set(ip, hits);
    return false;
  }
  hits.push(now);
  bucket.set(ip, hits);
  // 防止 Map 无限增长
  if (bucket.size > 5000) bucket.clear();
  return true;
}
