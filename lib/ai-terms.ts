/** AI 相关关键词，用于泛科技源（如 Hacker News）的过滤 */
export const AI_TERMS = [
  "ai",
  "a.i.",
  "agi",
  "llm",
  "slm",
  "gpt",
  "chatgpt",
  "claude",
  "gemini",
  "copilot",
  "llama",
  "deepseek",
  "qwen",
  "kimi",
  "mistral",
  "grok",
  "agent",
  "agentic",
  "prompt",
  "prompting",
  "rag",
  "mcp",
  "transformer",
  "diffusion",
  "embedding",
  "fine-tun",
  "inference",
  "machine learning",
  "deep learning",
  "neural",
  "openai",
  "anthropic",
  "deepmind",
  "hugging face",
  "midjourney",
  "stable diffusion",
  "sora",
  "vibe coding",
  "context window",
  "token",
  "人工智能",
  "大模型",
  "模型",
  "智能体",
  "提示词",
  "多模态",
  "机器学习",
  "深度学习",
  "神经网络",
  "算力",
  "具身",
  "文生图",
  "文生视频",
];

function escapeRe(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 英文短词必须整词匹配，否则 "ai" 会命中 "paid"、"email"、"said" 这类单词，
 * 把大量无关内容放进知识库。中文词照旧按子串匹配。
 */
const LATIN_ONLY = /^[a-z0-9.+#'\- ]+$/i;

export function buildAiOnlyRegex(): RegExp {
  const parts = AI_TERMS.map((term) => {
    const escaped = escapeRe(term);
    return LATIN_ONLY.test(term) ? `(?<![a-z0-9])${escaped}(?![a-z0-9])` : escaped;
  });
  return new RegExp(parts.join("|"), "i");
}

export const AI_ONLY_RE = buildAiOnlyRegex();
