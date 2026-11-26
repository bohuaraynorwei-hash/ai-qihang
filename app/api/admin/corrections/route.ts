import { checkAdmin, deny, json, jsonError } from "@/lib/auth";
import { applyCorrection } from "@/lib/proofread";
import { getCorrections, updateCorrection } from "@/lib/store";

export const dynamic = "force-dynamic";

/** 列出纠错记录（管理台） */
export async function GET(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  const all = await getCorrections();
  const filtered = status === "all" ? all : all.filter((c) => c.status === status);

  return json({
    ok: true,
    total: all.length,
    counts: {
      applied: all.filter((c) => c.status === "applied").length,
      pending: all.filter((c) => c.status === "pending").length,
      rejected: all.filter((c) => c.status === "rejected").length,
      human: all.filter((c) => c.source === "human").length,
    },
    items: filtered.slice(0, limit),
  });
}

/** 审核：通过（applied）或拒绝（rejected） */
export async function POST(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);

  let body: { id?: string; action?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(400, "请求体不是合法 JSON");
  }
  if (!body.id) return jsonError(400, "缺少纠错记录 id");
  if (body.action !== "apply" && body.action !== "reject") {
    return jsonError(400, "action 只能是 apply 或 reject");
  }

  const all = await getCorrections();
  const target = all.find((c) => c.id === body.id);
  if (!target) return jsonError(404, "找不到这条纠错记录");

  if (body.action === "apply") {
    const result = await applyCorrection(target);
    if (!result.ok) return jsonError(400, result.message);
    await updateCorrection(target.id, {
      status: "applied",
      reviewedBy: "admin",
      reviewedAt: new Date().toISOString(),
      blockedBy: undefined,
    });
    return json({ ok: true, message: "已应用并修正内容" });
  }

  await updateCorrection(target.id, {
    status: "rejected",
    reviewedBy: "admin",
    reviewedAt: new Date().toISOString(),
  });
  return json({ ok: true, message: "已忽略" });
}

/** 删除一条纠错记录（清掉误报 / 测试痕迹） */
export async function DELETE(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return jsonError(400, "缺少 id");

  const all = await getCorrections();
  const next = all.find((c) => c.id === id) ? all.filter((c) => c.id !== id) : null;
  if (!next) return jsonError(404, "找不到这条记录");

  const { saveCorrections } = await import("@/lib/store");
  const saved = await saveCorrections(next);
  return json({ ok: saved, message: saved ? "已删除" : "写入失败" });
}
