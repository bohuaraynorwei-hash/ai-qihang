import { DEFAULT_CONFIG } from "./defaults";
import { SEED_ITEMS } from "./seed";
import type { CrawlConfig, KnowledgeItem } from "./types";

const KEY_CONFIG = "aiqihang:config";
const KEY_ITEMS = "aiqihang:items";

type Memory = { config?: CrawlConfig; items?: KnowledgeItem[] };
const globalRef = globalThis as unknown as { __aiqihangMemory?: Memory };
const memory: Memory = (globalRef.__aiqihangMemory ??= {});

function creds(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.STORAGE_REST_API_URL ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.STORAGE_REST_API_TOKEN ||
    "";
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export function storageMode(): "redis" | "memory" {
  return creds() ? "redis" : "memory";
}

async function redisCommand(args: (string | number)[]): Promise<unknown> {
  const c = creds();
  if (!c) throw new Error("未配置 Redis");
  const res = await fetch(c.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis 返回 ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

async function redisGetJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisCommand(["GET", key]);
    if (typeof raw !== "string" || !raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[store] 读取 Redis 失败，降级到只读内容:", err);
    return null;
  }
}

async function redisSetJSON(key: string, value: unknown): Promise<boolean> {
  try {
    await redisCommand(["SET", key, JSON.stringify(value)]);
    return true;
  } catch (err) {
    console.error("[store] 写入 Redis 失败:", err);
    return false;
  }
}

export function normalizeConfig(input: Partial<CrawlConfig> | null | undefined): CrawlConfig {
  const base = DEFAULT_CONFIG;
  const merged: CrawlConfig = {
    ...base,
    ...(input || {}),
    sources:
      Array.isArray(input?.sources) && input!.sources.length > 0
        ? input!.sources.map((s) => ({ ...s }))
        : base.sources.map((s) => ({ ...s })),
    llm: { ...base.llm, ...(input?.llm || {}) },
    keywords: Array.isArray(input?.keywords) ? input!.keywords : [],
    lastRun: input?.lastRun ?? null,
    updatedAt: input?.updatedAt || base.updatedAt,
  };
  merged.maxPerSource = clamp(merged.maxPerSource, 1, 10, base.maxPerSource);
  merged.maxAgeDays = clamp(merged.maxAgeDays, 1, 90, base.maxAgeDays);
  merged.retention = clamp(merged.retention, 50, 2000, base.retention);
  merged.maxItemsPerRun = clamp(merged.maxItemsPerRun, 4, 60, base.maxItemsPerRun);
  return merged;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function getConfig(): Promise<CrawlConfig> {
  if (!creds()) return normalizeConfig(memory.config);
  const stored = await redisGetJSON<CrawlConfig>(KEY_CONFIG);
  if (!stored) return normalizeConfig(null);
  memory.config = normalizeConfig(stored);
  return memory.config;
}

export async function saveConfig(config: CrawlConfig): Promise<boolean> {
  const next = normalizeConfig({ ...config, updatedAt: new Date().toISOString() });
  memory.config = next;
  if (!creds()) return true;
  return redisSetJSON(KEY_CONFIG, next);
}

export async function getItems(): Promise<KnowledgeItem[]> {
  const stored = await getStoredItems();
  if (stored.length === 0) return SEED_ITEMS.map((i) => ({ ...i }));
  // 精选的冷启动内容始终保留，与每日抓取的条目合并展示（按 id 去重）
  const seen = new Set(stored.map((i) => i.id));
  const seeds = SEED_ITEMS.filter((s) => !seen.has(s.id)).map((s) => ({ ...s }));
  return [...stored, ...seeds];
}

/** 取知识库里的真实条目（不含冷启动种子），用于去重判断 */
export async function getStoredItems(): Promise<KnowledgeItem[]> {
  if (creds()) return (await redisGetJSON<KnowledgeItem[]>(KEY_ITEMS)) ?? [];
  return memory.items ?? [];
}

export async function saveItems(items: KnowledgeItem[]): Promise<boolean> {
  memory.items = items;
  if (!creds()) return true;
  return redisSetJSON(KEY_ITEMS, items);
}

export function configFromEnv(): Partial<CrawlConfig> | null {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return {
    llm: {
      enabled: true,
      baseUrl,
      apiKey,
      model: process.env.LLM_MODEL || "deepseek-chat",
      temperature: 0.3,
    },
  };
}
