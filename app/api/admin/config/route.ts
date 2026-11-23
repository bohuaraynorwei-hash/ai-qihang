import { checkAdmin, deny, json, jsonError } from "@/lib/auth";
import { resolveLLM } from "@/lib/llm";
import { getConfig, getItems, normalizeConfig, saveConfig, storageMode } from "@/lib/store";
import type { Category, CrawlConfig, LLMConfig, Source } from "@/lib/types";
import { hashId } from "@/lib/util";

export const dynamic = "force-dynamic";

const CATEGORIES: Category[] = ["news", "skill", "tool", "research"];

function sanitizeSources(input: unknown): Source[] | null {
  if (!Array.isArray(input)) return null;
  const out: Source[] = [];
  const usedIds = new Set<string>();
  input.slice(0, 40).forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const s = raw as Record<string, unknown>;
    const url = typeof s.url === "string" ? s.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) return;
    let id = typeof s.id === "string" && s.id ? s.id.trim().slice(0, 40) : hashId(url);
    if (usedIds.has(id)) id = `${id}-${index}`;
    usedIds.add(id);
    out.push({
      id,
      name: (typeof s.name === "string" && s.name.trim()) || `源 ${index + 1}`,
      url,
      category: CATEGORIES.includes(s.category as Category) ? (s.category as Category) : "news",
      enabled: Boolean(s.enabled),
      aiOnly: Boolean(s.aiOnly),
      note: typeof s.note === "string" ? s.note.slice(0, 200) : undefined,
    });
  });
  return out.length > 0 ? out : null;
}

function sanitizeLLM(input: unknown, current: LLMConfig): LLMConfig {
  if (!input || typeof input !== "object") return current;
  const raw = input as Record<string, unknown>;
  const baseUrl =
    typeof raw.baseUrl === "string" && raw.baseUrl.trim()
      ? raw.baseUrl.trim()
      : current.baseUrl;
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("大模型 Base URL 必须是 http(s) 地址");

  // 空字符串表示「不修改」，避免管理台把已保存的 key 清掉
  const apiKey = typeof raw.apiKey === "string" && raw.apiKey.trim() && !raw.apiKey.includes("•")
    ? raw.apiKey.trim()
    : current.apiKey;

  const temperature = Number(raw.temperature);
  return {
    enabled: raw.enabled === undefined ? current.enabled : Boolean(raw.enabled),
    baseUrl,
    apiKey,
    model: typeof raw.model === "string" && raw.model.trim() ? raw.model.trim() : current.model,
    temperature: Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : current.temperature,
  };
}

function publicConfig(config: CrawlConfig) {
  return {
    ...config,
    llm: { ...config.llm, apiKey: "" },
    llmKeySet: Boolean(config.llm.apiKey),
  };
}

async function statusPayload(config: CrawlConfig) {
  const items = await getItems();
  return {
    storage: storageMode(),
    items: items.length,
    adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
    cronConfigured: Boolean(process.env.CRON_SECRET),
    llmEnabled: resolveLLM(config.llm).enabled,
    llmKeySet: Boolean(config.llm.apiKey) || Boolean(process.env.LLM_API_KEY),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
  };
}

export async function GET(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);

  const config = await getConfig();
  return json({ ok: true, config: publicConfig(config), status: await statusPayload(config) });
}

export async function PUT(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "请求体不是合法 JSON");
  }

  const current = await getConfig();
  const next: CrawlConfig = { ...current, sources: current.sources, llm: { ...current.llm } };

  const sources = sanitizeSources(body.sources);
  if (sources) next.sources = sources;

  try {
    next.llm = sanitizeLLM(body.llm, current.llm);
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : "大模型配置不合法");
  }

  if (Array.isArray(body.keywords)) {
    next.keywords = body.keywords
      .filter((k): k is string => typeof k === "string")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  for (const key of ["maxPerSource", "maxAgeDays", "maxItemsPerRun", "retention"] as const) {
    if (body[key] !== undefined) next[key] = Number(body[key]);
  }

  const saved = await saveConfig(next);
  const persisted = await getConfig();

  return json({
    ok: saved,
    persisted: saved ? undefined : "写入 Redis 失败：请检查 KV_REST_API_URL / KV_REST_API_TOKEN",
    config: publicConfig(persisted),
    status: await statusPayload(persisted),
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET, PUT, OPTIONS" },
  });
}
