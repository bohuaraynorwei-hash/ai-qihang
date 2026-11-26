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
  /** 上次自动校对时间（ISO）。有值说明这条已经过一遍校对 */
  proofreadAt?: string;
  /** 被修正过的次数，详情页会显示「已校对」标记 */
  corrections?: number;
}

/** 纠错的类型：只有前三种允许自动应用 */
export type CorrectionKind = "typo" | "punctuation" | "grammar" | "term" | "fact" | "style";

export type CorrectionStatus = "applied" | "pending" | "rejected";

export interface Correction {
  id: string;
  itemId: string;
  /** 条目标题，方便在后台列表里认 */
  itemTitle: string;
  field: "title" | "summary" | "point";
  /** points 字段时，记录是第几条 */
  index?: number;
  before: string;
  after: string;
  /** 为什么改（模型给的理由，或人工填写） */
  reason: string;
  kind: CorrectionKind;
  status: CorrectionStatus;
  /** auto = 自动校对产出；human = 读者提交 */
  source: "auto" | "human";
  /** pending 时说明为什么没有自动应用 */
  blockedBy?: string;
  createdAt: string;
  /** 谁处理的（管理员介入时记录） */
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ProofreadReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** 本轮检查了多少条 */
  checked: number;
  /** 自动应用了多少处修正 */
  applied: number;
  /** 转为待人工确认的处数 */
  pending: number;
  llm: boolean;
  errors: string[];
  /** 逐条明细，方便核查 */
  details: {
    itemId: string;
    itemTitle: string;
    field: string;
    kind: CorrectionKind;
    before: string;
    after: string;
    status: CorrectionStatus;
    reason?: string;
  }[];
}
