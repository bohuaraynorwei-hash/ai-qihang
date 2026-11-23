import { json } from "@/lib/auth";
import { resolveLLM } from "@/lib/llm";
import { getConfig, getItems, storageMode } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [config, items] = await Promise.all([getConfig(), getItems()]);
  return json({
    ok: true,
    storage: storageMode(),
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
