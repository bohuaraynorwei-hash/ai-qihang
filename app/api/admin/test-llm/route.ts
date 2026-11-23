import { checkAdmin, deny, json, jsonError } from "@/lib/auth";
import { chatComplete, resolveLLM } from "@/lib/llm";
import { getConfig } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** 测试大模型接口是否可用（管理台用） */
export async function POST(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);

  let body: { baseUrl?: string; apiKey?: string; model?: string; temperature?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* 允许空 body，用已保存的配置 */
  }

  const config = await getConfig();
  const merged = {
    ...config.llm,
    baseUrl: body.baseUrl?.trim() || config.llm.baseUrl,
    apiKey: body.apiKey?.trim() || config.llm.apiKey || process.env.LLM_API_KEY || "",
    model: body.model?.trim() || config.llm.model,
    temperature: typeof body.temperature === "number" ? body.temperature : config.llm.temperature,
    enabled: true,
  };

  const llm = resolveLLM(merged);
  if (!llm.baseUrl || !llm.apiKey || !llm.model) {
    return jsonError(
      400,
      "配置不完整：需要 Base URL、API Key、模型名。也可以先在下方保存配置再测。"
    );
  }

  const started = Date.now();
  try {
    const sample = await chatComplete(
      llm,
      [
        { role: "system", content: "你是一个连通性测试助手，回答极简。" },
        { role: "user", content: "只回复两个字：可以" },
      ],
      { timeoutMs: 20000, maxTokens: 32 }
    );
    return json({
      ok: true,
      latencyMs: Date.now() - started,
      model: llm.model,
      sample: sample.slice(0, 120),
    });
  } catch (err) {
    return jsonError(
      502,
      `${err instanceof Error ? err.message : "调用失败"}（用时 ${Date.now() - started}ms）`
    );
  }
}
