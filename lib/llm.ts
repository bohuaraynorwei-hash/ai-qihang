import type { LLMConfig } from "./types";

export interface ResolvedLLM {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export function resolveLLM(input: LLMConfig): ResolvedLLM {
  const baseUrl = (input.baseUrl || process.env.LLM_BASE_URL || "").trim();
  const apiKey = (input.apiKey || process.env.LLM_API_KEY || "").trim();
  const model = (input.model || process.env.LLM_MODEL || "").trim();
  const enabled = Boolean(input.enabled) && Boolean(baseUrl) && Boolean(apiKey) && Boolean(model);
  return {
    enabled,
    baseUrl,
    apiKey,
    model,
    temperature:
      typeof input.temperature === "number" && input.temperature >= 0 && input.temperature <= 2
        ? input.temperature
        : 0.3,
  };
}

/** 兼容 OpenAI 风格的不同 baseUrl 写法：/v1、不带 /v1、直接给到 /chat/completions */
export function chatEndpoints(baseUrl: string): string[] {
  const base = baseUrl.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(base)) return [base];
  const list = [`${base}/chat/completions`];
  if (!/\/v\d+$/i.test(base)) list.push(`${base}/v1/chat/completions`);
  return Array.from(new Set(list));
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(
  llm: ResolvedLLM,
  messages: ChatMessage[],
  opts: { timeoutMs?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!llm.enabled) throw new Error("大模型未启用");
  const timeoutMs = opts.timeoutMs ?? 25000;
  let lastError: unknown = null;

  for (const endpoint of chatEndpoints(llm.baseUrl)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${llm.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: llm.model,
          messages,
          temperature: llm.temperature,
          max_tokens: opts.maxTokens ?? 1800,
          stream: false,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await res.text();
      if (!res.ok) {
        lastError = new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
        if (res.status === 404 || res.status === 405) continue;
        throw lastError;
      }
      const json = JSON.parse(text) as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };
      if (json.error) throw new Error(json.error.message || "大模型返回错误");
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("大模型返回内容为空");
      return content;
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("调用大模型失败");
}

/** 从模型输出里尽量抠出 JSON（容忍 ```json 包裹、前后废话） */
export function extractJSON<T>(raw: string): T | null {
  const text = raw.trim();
  const candidates: string[] = [];

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1]);
  candidates.push(text);

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(text.slice(firstBracket, lastBracket + 1));
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {
      /* 继续试下一个 */
    }
  }
  return null;
}

export async function chatJSON<T>(
  llm: ResolvedLLM,
  system: string,
  user: string,
  opts: { timeoutMs?: number; maxTokens?: number } = {}
): Promise<T | null> {
  const raw = await chatComplete(
    llm,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    opts
  );
  return extractJSON<T>(raw);
}
