import { DEFAULT_CONFIG } from "./defaults";
import { SEED_ITEMS } from "./seed";
import type { CrawlConfig, KnowledgeItem } from "./types";

const KEY_CONFIG = "aiqihang:config";
const KEY_ITEMS = "aiqihang:items";

type Memory = { config?: CrawlConfig; items?: KnowledgeItem[] };
const globalRef = globalThis as unknown as { __aiqihangMemory?: Memory };
const memory: Memory = (globalRef.__aiqihangMemory ??= {});

/** Upstash 的 HTTP REST 接口（Vercel 上的默认方案） */
function upstashCreds(): { url: string; token: string } | null {
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

/**
 * 标准 Redis 连接串（腾讯云 Redis / 阿里云 Redis / 自建 / docker）。
 * 形如 redis://[:password@]host:port[/db]，或 rediss:// 走 TLS。
 * 这些服务用的是标准 RESP 协议，不能走上面那套 HTTP REST。
 */
function standardRedisUrl(): string | null {
  const raw =
    process.env.REDIS_URL ||
    process.env.TENCENT_REDIS_URL ||
    process.env.KV_URL || // Upstash 集成也会注入 KV_URL（redis:// 形式）
    "";
  if (!raw) return null;
  if (!/^rediss?:\/\//i.test(raw)) return null;
  return raw;
}

export type StorageBackend = "upstash" | "redis" | "memory";

export function storageBackend(): StorageBackend {
  if (upstashCreds()) return "upstash";
  if (standardRedisUrl()) return "redis";
  return "memory";
}

/** 对外的粗粒度模式：有持久化就报 redis，页面/管理台按这个判断 */
export function storageMode(): "redis" | "memory" {
  return storageBackend() === "memory" ? "memory" : "redis";
}

/** 给管理台展示的具体后端名 */
export function storageLabel(): string {
  switch (storageBackend()) {
    case "upstash":
      return "Upstash Redis（HTTP REST）";
    case "redis":
      return "Redis（标准协议）";
    default:
      return "内存（不持久化）";
  }
}

// ---------------------------------------------------------------- ioredis 客户端

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  ping(): Promise<string>;
};

const clientRef = globalThis as unknown as { __aiqihangRedis?: Promise<RedisLike> };
const MAX_ATTEMPTS = 8;

async function getRedisClient(): Promise<RedisLike> {
  if (clientRef.__aiqihangRedis) return clientRef.__aiqihangRedis;
  const url = standardRedisUrl();
  if (!url) throw new Error("未配置 REDIS_URL");

  clientRef.__aiqihangRedis = (async () => {
    const mod = (await import("ioredis")) as unknown as {
      default: new (url: string, opts?: Record<string, unknown>) => RedisLike;
    };
    const RedisCtor = mod.default;
    const client = new RedisCtor(url, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 2,
      // 云 Redis（腾讯云内网）首次解析可能稍慢，重试几次
      retryStrategy: (times: number) => (times > MAX_ATTEMPTS ? null : Math.min(times * 200, 2000)),
    });
    (client as unknown as { on: (e: string, cb: (err: unknown) => void) => void }).on(
      "error",
      (err: unknown) => {
        console.error("[store] Redis 连接错误:", err instanceof Error ? err.message : err);
      }
    );
    await client.ping();
    return client;
  })();

  try {
    return await clientRef.__aiqihangRedis;
  } catch (err) {
    clientRef.__aiqihangRedis = undefined;
    throw err;
  }
}

// ---------------------------------------------------------------- 统一读写

async function redisCommand(args: (string | number)[]): Promise<unknown> {
  const c = upstashCreds();
  if (!c) throw new Error("未配置 Upstash Redis");
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

async function kvGet(key: string): Promise<string | null> {
  const backend = storageBackend();
  if (backend === "upstash") {
    const raw = await redisCommand(["GET", key]);
    return typeof raw === "string" ? raw : null;
  }
  if (backend === "redis") {
    const client = await getRedisClient();
    return await client.get(key);
  }
  return null;
}

async function kvSet(key: string, value: string): Promise<void> {
  const backend = storageBackend();
  if (backend === "upstash") {
    await redisCommand(["SET", key, value]);
    return;
  }
  if (backend === "redis") {
    const client = await getRedisClient();
    await client.set(key, value);
    return;
  }
  throw new Error("未配置任何持久化存储");
}

/** 连通性自检，管理台/健康检查用 */
export async function pingStorage(): Promise<{ ok: boolean; backend: StorageBackend; error?: string }> {
  const backend = storageBackend();
  if (backend === "memory") return { ok: false, backend, error: "未配置持久化存储" };
  try {
    if (backend === "upstash") await redisCommand(["PING"]);
    else {
      const client = await getRedisClient();
      await client.ping();
    }
    return { ok: true, backend };
  } catch (err) {
    return { ok: false, backend, error: err instanceof Error ? err.message : String(err) };
  }
}

async function redisGetJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await kvGet(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[store] 读取存储失败，降级到只读内容:", err);
    return null;
  }
}

async function redisSetJSON(key: string, value: unknown): Promise<boolean> {
  try {
    await kvSet(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error("[store] 写入存储失败:", err);
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
  if (storageBackend() === "memory") return normalizeConfig(memory.config);
  const stored = await redisGetJSON<CrawlConfig>(KEY_CONFIG);
  if (!stored) return normalizeConfig(null);
  memory.config = normalizeConfig(stored);
  return memory.config;
}

export async function saveConfig(config: CrawlConfig): Promise<boolean> {
  const next = normalizeConfig({ ...config, updatedAt: new Date().toISOString() });
  memory.config = next;
  if (storageBackend() === "memory") return true;
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
  if (storageBackend() !== "memory") {
    return (await redisGetJSON<KnowledgeItem[]>(KEY_ITEMS)) ?? [];
  }
  return memory.items ?? [];
}

export async function saveItems(items: KnowledgeItem[]): Promise<boolean> {
  memory.items = items;
  if (storageBackend() === "memory") return true;
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
