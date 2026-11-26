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

/** 本地化/翻译相关关键词：用于泛 AI 源只保留「跟本地化沾边」的条目 */
export const L10N_TERMS = [
  // 中文
  "本地化",
  "翻译",
  "译员",
  "译者",
  "译制",
  "校对",
  "审校",
  "术语",
  "多语言",
  "多语种",
  "语言服务",
  "字幕",
  "配音",
  "口译",
  "文本转语音",
  "语音合成",
  "机器翻译",
  "语料",
  "出海",
  // 英文
  "localization",
  "localisation",
  "localize",
  "localise",
  "translation",
  "translate",
  "translator",
  "transcreation",
  "l10n",
  "i18n",
  "g11n",
  "multilingual",
  "language service",
  "language service provider",
  "LSP",
  "language pair",
  "terminology",
  "glossary",
  "translation memory",
  "machine translation",
  "neural machine translation",
  "post-editing",
  "mtpe",
  "subtitl",
  "dubbing",
  "voice cloning",
  "text-to-speech",
  "speech-to-text",
  "linguist",
  "CAT tool",
  "TMS",
];

export function buildL10nRegex(): RegExp {
  const parts = L10N_TERMS.map((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (/^[a-z0-9 .+#'\-]+$/i.test(term)) {
      // 英文词允许复数：translation(s)、language service(s)
      return `(?<![a-z0-9])${escaped}s?(?![a-z0-9])`;
    }
    // 中文按子串匹配
    return escaped;
  });
  return new RegExp(parts.join("|"), "i");
}

export const L10N_ONLY_RE = buildL10nRegex();
