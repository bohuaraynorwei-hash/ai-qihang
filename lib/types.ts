export type Category = "news" | "skill" | "tool" | "research";
export type Level = "入门" | "进阶";

export interface Source {
  id: string;
  name: string;
  url: string;
  category: Category;
  enabled: boolean;
  note?: string;
  /** true = 该源是泛科技源，只保留命中 AI 关键词的条目 */
  aiOnly?: boolean;
  /** true = 泛 AI 源，只保留「跟本地化/翻译沾边」的条目 */
  l10nOnly?: boolean;
}

export interface LLMConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface CrawlReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  added: number;
  total: number;
  llm: boolean;
  storage: "redis" | "memory";
  sources: {
    sourceId: string;
    name: string;
    fetched: number;
    added: number;
    error?: string;
  }[];
  errors: string[];
}

export interface CrawlConfig {
  version: number;
  sources: Source[];
  /** 每个源每次最多取几条 */
  maxPerSource: number;
  /** 只收最近 N 天发布的 */
  maxAgeDays: number;
  /** 单次抓取最多入库多少条（控制运行时长大模型调用次数） */
  maxItemsPerRun: number;
  /** 关键词过滤，空数组 = 不过滤 */
  keywords: string[];
  llm: LLMConfig;
  /** 知识库最多保留多少条 */
  retention: number;
  updatedAt: string;
  lastRun: CrawlReport | null;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  points: string[];
  category: Category;
  tags: string[];
  level: Level;
  publishedAt: string;
  crawledAt: string;
  lang: "zh" | "en" | "other";
}
