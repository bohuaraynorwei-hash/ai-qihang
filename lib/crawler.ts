import { AI_ONLY_RE } from "./ai-terms";
import { chatJSON, resolveLLM, type ResolvedLLM } from "./llm";
import { parseFeed, stripHtml } from "./rss";
import { getConfig, getItems, getStoredItems, saveConfig, saveItems, storageMode } from "./store";
import type {
  Category,
  CrawlConfig,
  CrawlReport,
  KnowledgeItem,
  Level,
  Source,
} from "./types";
import { hashId, looksChinese, mapLimit, truncate, uniq } from "./util";

const FETCH_TIMEOUT = 9000;
const LLM_BATCH = 6;
const LLM_TIMEOUT = 22000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 AIQihangBot/1.0";

interface Candidate {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  source: Source;
}

interface Enriched {
  i: number;
  title: string;
  summary: string;
  points: string[];
  category: Category;
  tags: string[];
  level: Level;
}

function assertPublicUrl(raw: string): URL {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("只支持 http/https 地址");
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host === "[::1]" ||
    /^127\./.test(host) ||
    /^0\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) throw new Error("不允许抓取内网/本机地址");
  return url;
}

async function fetchText(url: string): Promise<string> {
  assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function cleanSummary(raw: string): string {
  return stripHtml(raw)
    .replace(/Article URL:\s*\S+/gi, "")
    .replace(/Comments URL:\s*\S+/gi, "")
    .replace(/Points:\s*\d+/gi, "")
    .replace(/#\s*Comments/gi, "")
    .replace(/\bRead more\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFresh(publishedAt: string, maxAgeDays: number): boolean {
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return true;
  const age = Date.now() - t;
  return age <= maxAgeDays * 24 * 3600 * 1000 && age > -36 * 3600 * 1000;
}

function guessCategory(source: Source, text: string): Category {
  if (/教程|指南|how to|guide|tips|技巧|prompt/i.test(text)) return "skill";
  if (/发布|上线|开源|release|launch|tool|插件/i.test(text)) return "tool";
  if (/论文|研究|paper|research|benchmark/i.test(text)) return "research";
  return source.category;
}

function guessTags(text: string): string[] {
  const map: [RegExp, string][] = [
    [/agent|智能体/i, "Agent"],
    [/prompt|提示词/i, "提示词"],
    [/skill|技能/i, "Skill"],
    [/mcp/i, "MCP"],
    [/rag|检索/i, "RAG"],
    [/代码|code|coding|copilot|cursor/i, "编程"],
    [/图像|image|midjourney|绘图/i, "图像"],
    [/视频|video|sora/i, "视频"],
    [/语音|audio|voice/i, "语音"],
    [/开源|open.?source/i, "开源"],
    [/模型|model/i, "模型"],
    [/办公|表格|excel|文档/i, "办公"],
  ];
  return uniq(map.filter(([re]) => re.test(text)).map(([, tag]) => tag)).slice(0, 4);
}

const SYSTEM_PROMPT = `你是中文 AI 教育平台「AI 启航」的内容编辑，读者是完全的 AI 新手。
给你一批英文/中文的 AI 资讯标题和摘要，请为每一条写成新手能看懂的卡片。

要求：
1. 用中文重写标题：保留专有名词英文原名（如 GPT-5、Claude、MCP），不要用夸张营销词（"炸裂""颠覆"）。
2. summary：2-3 句，讲清楚"发生了什么 / 对普通用户意味着什么"。禁止编造原文没有的数字和事实；原文信息不足就只写能确定的部分。
3. points：2-3 条要点，每条不超过 28 字，写"能带走的东西"而不是复述标题。信息不足时可以给 1 条。
4. category 只能取 news（行业动态）/ skill（使用技巧）/ tool（工具上新）/ research（前沿研究）之一。
5. tags：2-4 个中文短标签，如 "Agent"、"提示词"、"开源"、"编程"。
6. level：新手也能立刻懂的填 "入门"，需要一点技术背景的填 "进阶"。
7. 只输出 JSON 数组，不要任何解释文字。格式：
[{"i":0,"title":"...","summary":"...","points":["..."],"category":"news","tags":["..."],"level":"入门"}]`;

async function enrichWithLLM(
  llm: ResolvedLLM,
  candidates: Candidate[]
): Promise<Map<number, Enriched>> {
  const result = new Map<number, Enriched>();
  for (let start = 0; start < candidates.length; start += LLM_BATCH) {
    const batch = candidates.slice(start, start + LLM_BATCH);
    const payload = batch.map((c, idx) => ({
      i: start + idx,
      title: c.title,
      desc: truncate(c.summary, 600),
      source: c.source.name,
    }));
    try {
      const parsed = await chatJSON<Enriched[]>(
        llm,
        SYSTEM_PROMPT,
        `以下是待处理的条目：\n${JSON.stringify(payload, null, 1)}`,
        { timeoutMs: LLM_TIMEOUT, maxTokens: 1500 }
      );
      if (!Array.isArray(parsed)) continue;
      for (const entry of parsed) {
        if (typeof entry?.i !== "number") continue;
        if (!entry.title || !entry.summary) continue;
        result.set(entry.i, {
          i: entry.i,
          title: String(entry.title).trim(),
          summary: truncate(String(entry.summary).trim(), 400),
          points: Array.isArray(entry.points)
            ? entry.points.map((p) => truncate(String(p), 40)).filter(Boolean).slice(0, 3)
            : [],
          category: (["news", "skill", "tool", "research"] as Category[]).includes(entry.category)
            ? entry.category
            : "news",
          tags: Array.isArray(entry.tags)
            ? entry.tags.map((t) => truncate(String(t), 12)).filter(Boolean).slice(0, 4)
            : [],
          level: entry.level === "进阶" ? "进阶" : "入门",
        });
      }
    } catch (err) {
      console.error("[crawl] 大模型处理失败，本批走原文兜底:", err);
    }
  }
  return result;
}

function fallbackItem(candidate: Candidate): KnowledgeItem {
  const text = `${candidate.title} ${candidate.summary}`;
  const summary = candidate.summary
    ? truncate(candidate.summary, 260)
    : "原文没有提供摘要，建议点开链接查看完整内容。";
  return {
    id: hashId(candidate.url),
    title: truncate(candidate.title, 120),
    url: candidate.url,
    source: candidate.source.name,
    summary,
    points: [],
    category: guessCategory(candidate.source, text),
    tags: guessTags(text),
    level: "入门",
    publishedAt: candidate.publishedAt,
    crawledAt: new Date().toISOString(),
    lang: looksChinese(text) ? "zh" : "en",
  };
}

/** 按来源轮转挑选，防止某个更新频繁的源占满整期内容 */
function interleaveBySource(items: Candidate[], limit: number): Candidate[] {
  const sorted = [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const buckets = new Map<string, Candidate[]>();
  for (const item of sorted) {
    const bucket = buckets.get(item.source.id);
    if (bucket) bucket.push(item);
    else buckets.set(item.source.id, [item]);
  }
  const order = Array.from(buckets.keys());
  const out: Candidate[] = [];
  while (out.length < limit) {
    let added = false;
    for (const key of order) {
      const bucket = buckets.get(key)!;
      const next = bucket.shift();
      if (next) {
        out.push(next);
        added = true;
        if (out.length >= limit) break;
      }
    }
    if (!added) break;
  }
  return out;
}

export interface RunCrawlOptions {
  /** 只跑指定源（调试/手动补抓用） */
  sourceIds?: string[];
  /** 覆盖配置里的单次上限 */
  maxItems?: number;
}

export async function runCrawl(
  config: CrawlConfig,
  options: RunCrawlOptions = {}
): Promise<CrawlReport> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const errors: string[] = [];
  const llm = resolveLLM(config.llm);

  const enabled = config.sources.filter(
    (s) => s.enabled && (!options.sourceIds?.length || options.sourceIds.includes(s.id))
  );
  const maxItems = options.maxItems ?? config.maxItemsPerRun;

  const stored = await getStoredItems();
  const storedIds = new Set(stored.map((i) => i.id));
  const seenIds = new Set<string>();
  const candidates: Candidate[] = [];
  const sourceResults: CrawlReport["sources"] = [];

  await mapLimit(enabled, 4, async (source) => {
    const row: CrawlReport["sources"][number] = {
      sourceId: source.id,
      name: source.name,
      fetched: 0,
      added: 0,
    };
    try {
      const xml = await fetchText(source.url);
      const feedItems = parseFeed(xml, source.url, 30);
      row.fetched = feedItems.length;
      if (feedItems.length === 0) {
        row.error = "解析到 0 条（可能不是 RSS，或被反爬拦截）";
      }
      let perSource = 0;
      for (const item of feedItems) {
        // 每个源单独限流，避免某个更新频繁的源吃掉全部配额
        if (perSource >= config.maxPerSource) break;
        if (!isFresh(item.publishedAt, config.maxAgeDays)) continue;
        const id = hashId(item.url);
        if (storedIds.has(id) || seenIds.has(id)) continue;
        const text = `${item.title} ${item.summary}`;
        if (source.aiOnly && !AI_ONLY_RE.test(text)) continue;
        if (config.keywords.length > 0) {
          const hit = config.keywords.some((k) => text.toLowerCase().includes(k.toLowerCase()));
          if (!hit) continue;
        }
        seenIds.add(id);
        perSource++;
        candidates.push({
          title: item.title,
          url: item.url,
          summary: cleanSummary(item.summary),
          publishedAt: item.publishedAt,
          source,
        });
      }
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      errors.push(`${source.name}: ${row.error}`);
    }
    sourceResults.push(row);
  });

  // 按发布时间倒序 + 源间轮转，保证「最新」优先入库，同时内容不偏科
  const picked = interleaveBySource(candidates, maxItems);

  const enriched: Map<number, Enriched> =
    llm.enabled && picked.length > 0 ? await enrichWithLLM(llm, picked) : new Map();

  const now = new Date().toISOString();
  const fresh: KnowledgeItem[] = picked.map((candidate, index) => {
    const base = fallbackItem(candidate);
    const ai = enriched.get(index);
    if (!ai) return { ...base, crawledAt: now };
    return {
      ...base,
      title: truncate(ai.title, 120) || base.title,
      summary: ai.summary || base.summary,
      points: ai.points,
      category: ai.category,
      tags: ai.tags.length > 0 ? ai.tags : base.tags,
      level: ai.level,
      crawledAt: now,
    };
  });

  const all = [...fresh, ...stored]
    .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, config.retention);

  const saved = await saveItems(all);

  for (const row of sourceResults) {
    row.added = fresh.filter((i) => i.source === row.name).length;
  }

  const report: CrawlReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    added: fresh.length,
    total: all.length,
    llm: llm.enabled,
    storage: storageMode(),
    sources: sourceResults.sort((a, b) => b.added - a.added),
    errors,
  };

  if (!saved) report.errors.push("写入存储失败，请检查 Redis 环境变量");

  await saveConfig({ ...config, lastRun: report });
  return report;
}

export async function crawlWithConfig(options: RunCrawlOptions = {}): Promise<CrawlReport> {
  const config = await getConfig();
  return runCrawl(config, options);
}

/** 页面统计用：总条数、来源数、最近更新时间 */
export async function getStats() {
  const items = await getItems();
  const sources = uniq(items.map((i) => i.source));
  const lastCrawled = items
    .map((i) => i.crawledAt)
    .sort((a, b) => b.localeCompare(a))[0];
  return {
    total: items.length,
    sources: sources.length,
    lastCrawled: lastCrawled || null,
  };
}
