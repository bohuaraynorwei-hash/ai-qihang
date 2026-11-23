import type { Category, CrawlConfig, Source } from "./types";

export const CATEGORY_META: Record<
  Category,
  { label: string; short: string; color: string; desc: string }
> = {
  news: {
    label: "行业动态",
    short: "动态",
    color: "#4f46e5",
    desc: "模型发布、公司动向、政策变化，知道发生了什么就够了",
  },
  skill: {
    label: "使用技巧",
    short: "技巧",
    color: "#0d9488",
    desc: "别人踩过的坑和总结出来的用法，直接抄作业",
  },
  tool: {
    label: "工具上新",
    short: "工具",
    color: "#0284c7",
    desc: "新的 AI 产品、插件、开源项目，挑顺手的用",
  },
  research: {
    label: "前沿研究",
    short: "研究",
    color: "#9333ea",
    desc: "论文与实验室进展，看不懂也没关系，看结论",
  },
};

export const LEVEL_META = {
  入门: { color: "#0d9488", bg: "#ecfdf5" },
  进阶: { color: "#b45309", bg: "#fffbeb" },
} as const;

export const DEFAULT_SOURCES: Source[] = [
  {
    id: "hn",
    name: "Hacker News 高分",
    url: "https://hnrss.org/frontpage?points=150",
    category: "news",
    enabled: true,
    aiOnly: true,
    note: "技术圈风向标，AI 相关讨论基本都在这里先出现（只保留命中 AI 关键词的帖子）",
  },
  {
    id: "openai",
    name: "OpenAI 官方博客",
    url: "https://openai.com/news/rss.xml",
    category: "news",
    enabled: true,
    note: "一手信息：模型发布与产品更新",
  },
  {
    id: "googleai",
    name: "Google AI 博客",
    url: "https://blog.google/technology/ai/rss/",
    category: "news",
    enabled: true,
  },
  {
    id: "huggingface",
    name: "Hugging Face 博客",
    url: "https://huggingface.co/blog/feed.xml",
    category: "tool",
    enabled: true,
    note: "开源模型与实操教程密度最高的地方之一",
  },
  {
    id: "simonw",
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    category: "skill",
    enabled: true,
    note: "最会写「怎么用」的人之一，几乎每篇都能直接上手",
  },
  {
    id: "qbitai",
    name: "量子位",
    url: "https://www.qbitai.com/feed",
    category: "news",
    enabled: true,
    note: "中文圈 AI 资讯，适合快速扫一眼",
  },
  {
    id: "githubait",
    name: "GitHub AI & ML",
    url: "https://github.blog/ai-and-ml/feed/",
    category: "tool",
    enabled: true,
    note: "Copilot 与 AI 编程相关的新玩法",
  },
  {
    id: "mitai",
    name: "MIT 科技评论 · AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    category: "research",
    enabled: true,
    note: "偏解读，适合了解趋势背后的原因",
  },
  {
    id: "techcrunch",
    name: "TechCrunch · AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    category: "news",
    enabled: true,
  },
  {
    id: "deepmind",
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
    category: "research",
    enabled: true,
  },
  {
    id: "bair",
    name: "Berkeley BAIR",
    url: "https://bair.berkeley.edu/blog/feed.xml",
    category: "research",
    enabled: false,
    note: "偏学术，更新慢但质量高",
  },
  {
    id: "theverge",
    name: "The Verge · AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    category: "news",
    enabled: false,
  },
  {
    id: "venturebeat",
    name: "VentureBeat · AI",
    url: "https://venturebeat.com/category/ai/feed/",
    category: "news",
    enabled: false,
    note: "已实测偶发 429 限流，需要时再开",
  },
  {
    id: "anthropic",
    name: "Anthropic Engineering",
    url: "https://www.anthropic.com/engineering/rss.xml",
    category: "skill",
    enabled: false,
    note: "官方暂未提供稳定 RSS，抓取常失败；可自行换镜像源",
  },
  {
    id: "reddit",
    name: "Reddit r/ChatGPT",
    url: "https://www.reddit.com/r/ChatGPT/.rss",
    category: "skill",
    enabled: false,
    note: "社区经验帖，但 Reddit 对服务器抓取限制较多",
  },
];

export const DEFAULT_CONFIG: CrawlConfig = {
  version: 1,
  sources: DEFAULT_SOURCES,
  maxPerSource: 3,
  maxAgeDays: 10,
  maxItemsPerRun: 24,
  keywords: [],
  llm: {
    enabled: false,
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    model: "deepseek-chat",
    temperature: 0.3,
  },
  retention: 600,
  updatedAt: new Date(0).toISOString(),
  lastRun: null,
};

/** 从环境变量兜底注入大模型配置，方便不想开管理台的情况 */
export function envLLM() {
  return {
    baseUrl: process.env.LLM_BASE_URL || "",
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "",
  };
}
