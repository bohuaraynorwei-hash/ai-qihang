import { json } from "@/lib/auth";
import { resolveLLM } from "@/lib/llm";
import { getConfig, getItems, pingStorage, storageBackend, storageLabel } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";

  const [config, items] = await Promise.all([getConfig(), getItems()]);
  const backend = storageBackend();
  const storagePing = deep ? await pingStorage() : null;

  return json({
    ok: true,
    // 保留旧的 storage 字段（"redis" / "memory"），兼容管理台与外部检查脚本
    storage: backend === "memory" ? "memory" : "redis",
    storageBackend: backend,
    storageLabel: storageLabel(),
    storagePing,
    items: items.length,
    sources: config.sources.filter((s) => s.enabled).length,
    llmEnabled: resolveLLM(config.llm).enabled,
    adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
    cronConfigured: Boolean(process.env.CRON_SECRET),
    lastRun: config.lastRun?.finishedAt ?? null,
    updatedAt: config.updatedAt,
    now: new Date().toISOString(),
  });
}
