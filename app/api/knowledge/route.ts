import { json, jsonError } from "@/lib/auth";
import { filterItems, sortByTime } from "@/lib/query";
import { getItems } from "@/lib/store";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID: Category[] = ["news", "skill", "tool", "research"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const rawCategory = url.searchParams.get("category") || "all";
  const category = VALID.includes(rawCategory as Category) ? (rawCategory as Category) : "all";
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  try {
    const items = sortByTime(await getItems());
    const filtered = filterItems(items, { q, category });
    return json({
      ok: true,
      total: filtered.length,
      limit,
      offset,
      items: filtered.slice(offset, offset + limit),
    });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : "读取知识库失败");
  }
}
