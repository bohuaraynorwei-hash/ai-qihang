/**
 * 自动纠错（proofread）
 * =====================
 * 用大模型校对已入库条目的标题 / 摘要 / 要点，只修「明显是错的」东西：
 * 错别字、重复字、错标点、明显语病。
 *
 * 两条铁律：
 * 1. **不做改写**。任何超出自纠错范围的改动，一律降级为「待人工确认」而不是直接应用。
 * 2. **可追溯**。每处改动都留 before/after/reason，管理台能回滚。
 *
 * 安全阀（validateFix）：
 * - 文本相似度必须在阈值内（改动幅度太大 = 在改写，拒绝）
 * - 长度变化必须在阈值内
 * - before 必须和库里当前值一致（防并发覆盖）
 */

import { chatJSON, resolveLLM, type ResolvedLLM } from "./llm";
import {
  appendCorrections,
  getStoredItems,
  saveItems,
} from "./store";
import type {
  Correction,
  CorrectionKind,
  CorrectionStatus,
  CrawlConfig,
  KnowledgeItem,
  ProofreadReport,
} from "./types";
import { hashId, truncate } from "./util";

const BATCH_SIZE = 6;
const LLM_TIMEOUT = 25000;

/** 改动幅度上限：编辑距离 / 原长度 */
const MAX_CHANGE_RATIO = 0.35;
/** 长度变化上限 */
const MAX_LEN_RATIO = 1.4;
/** 单条字段最大长度（防止模型输出跑飞） */
const MAX_FIELD_LEN = 800;

/** 只有这几类允许自动应用，其余一律待人工确认 */
const AUTO_APPLY_KINDS: CorrectionKind[] = ["typo", "punctuation", "grammar"];

const SYSTEM_PROMPT = `你是中文校对员，只做最保守的纠错。

任务：给出文本里**确实错了**的地方，并修正。

只允许改这四类：
1. typo：错别字（如「事节」→「事项」、「即使」写成「既使」）
2. punctuation：标点误用（全半角混用、多余空格、重复标点）
3. grammar：明显语病或重复字（如「的的」「进行进行」「是是」）
4. term：专有名词写错（如「Cluade」→「Claude」，「Unreal」写成「Unrael」）

严禁：
- 改写措辞、调整语气、精简或扩写句子
- 修改事实、数字、日期（即使你怀疑它错，也只能在 reason 里提，after 必须保持原样）
- 调整段落顺序、增删内容
- 把口语改成书面语，或反过来

判断标准：如果原文和你的版本「读起来意思一样但说法不同」——那不是错，不要改。

输出 JSON 数组，只输出数组本身：
[{"i":0,"field":"summary","before":"原文片段","after":"修正片段","kind":"typo","reason":"一句话说明"}]

字段说明：
- i：这条文本在输入里的编号
- field：title / summary / point
- before：**必须是原文里逐字出现的连续片段**（不要概括、不要加省略号）
- after：只替换 before 那一段，其余保持不变
- kind：typo / punctuation / grammar / term
- reason：不超过 20 字

如果某条完全没问题，就不要为它输出任何项。宁可漏改，不可错改。`;

interface RawFix {
  i?: number;
  field?: string;
  before?: string;
  after?: string;
  kind?: string;
  reason?: string;
}

const VALID_KINDS: CorrectionKind[] = ["typo", "punctuation", "grammar", "term", "fact", "style"];

/** Levenshtein 距离（短文本够用，O(n*m)） */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

interface Validation {
  ok: boolean;
  reason?: string;
}

/** 校验一处修正是否可以「自动应用」。导出以便单测。 */
export function validateFix(
  field: string,
  before: string,
  after: string,
  kind: CorrectionKind
): Validation {
  if (!before || !after) return { ok: false, reason: "before/after 为空" };
  if (before === after) return { ok: false, reason: "没有实际改动" };
  if (after.length > MAX_FIELD_LEN) return { ok: false, reason: "修正后文本过长" };

  // 只允许 typo / punctuation / grammar 自动应用
  if (!AUTO_APPLY_KINDS.includes(kind)) {
    return { ok: false, reason: `类型 ${kind} 不在自动应用范围` };
  }

  // 长度变化过大 → 大概率在改写
  const lenRatio = after.length / Math.max(1, before.length);
  if (lenRatio > MAX_LEN_RATIO || lenRatio < 1 / MAX_LEN_RATIO) {
    return { ok: false, reason: `长度变化过大（${before.length}→${after.length}）` };
  }

  // 改动幅度过大 → 在改写，不是纠错
  const dist = levenshtein(before, after);
  const ratio = dist / Math.max(1, Math.max(before.length, after.length));
  if (ratio > MAX_CHANGE_RATIO) {
    return { ok: false, reason: `改动幅度 ${(ratio * 100).toFixed(0)}% 超过上限` };
  }

  // field 必须是已知字段
  if (!["title", "summary", "point"].includes(field)) {
    return { ok: false, reason: `未知字段 ${field}` };
  }

  return { ok: true };
}

interface Target {
  item: KnowledgeItem;
  /** 待校对文本：编号 → 字段定位 */
  slots: { field: "title" | "summary" | "point"; index?: number; text: string }[];
}

function buildTarget(item: KnowledgeItem): Target {
  const slots: Target["slots"] = [];
  if (item.title) slots.push({ field: "title", text: item.title });
  if (item.summary) slots.push({ field: "summary", text: item.summary });
  item.points.forEach((p, i) => {
    if (p) slots.push({ field: "point", index: i, text: p });
  });
  return { item, slots };
}

function renderPrompt(targets: Target[]): string {
  const lines: string[] = ["下面是需要校对的文本：", ""];
  let n = 0;
  const map: { n: number; itemId: string; field: string; index?: number; text: string }[] = [];
  for (const t of targets) {
    for (const slot of t.slots) {
      lines.push(`[${n}] (${slot.field}) ${slot.text}`);
      map.push({ n, itemId: t.item.id, field: slot.field, index: slot.index, text: slot.text });
      n++;
    }
  }
  return lines.join("\n");
}

export interface ProofreadOptions {
  /** 只校对指定条目 */
  itemIds?: string[];
  /** 最多校对多少条（控成本） */
  limit?: number;
  /** true = 连已校对过的也重新校对 */
  force?: boolean;
}

export async function runProofread(
  config: CrawlConfig,
  options: ProofreadOptions = {}
): Promise<ProofreadReport> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const llm = resolveLLM(config.llm);
  const errors: string[] = [];
  const details: ProofreadReport["details"] = [];
  const newCorrections: Correction[] = [];

  if (!llm.enabled) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      checked: 0,
      applied: 0,
      pending: 0,
      llm: false,
      errors: ["大模型未启用，无法自动纠错。请先在管理台配置 API。"],
      details: [],
    };
  }

  const stored = await getStoredItems();
  if (stored.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      checked: 0,
      applied: 0,
      pending: 0,
      llm: true,
      errors: ["知识库为空，没有可校对的内容。"],
      details: [],
    };
  }

  // 候选：按发布时间倒序（新内容先校对），跳过已校对过的
  const limit = Math.max(1, Math.min(60, options.limit ?? 20));
  let candidates = [...stored].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (options.itemIds?.length) {
    candidates = candidates.filter((i) => options.itemIds!.includes(i.id));
  } else if (!options.force) {
    candidates = candidates.filter((i) => !i.proofreadAt);
  }
  candidates = candidates.slice(0, limit);

  if (candidates.length === 0) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      checked: 0,
      applied: 0,
      pending: 0,
      llm: true,
      errors: [],
      details: [],
    };
  }

  const byId = new Map(stored.map((i) => [i.id, i]));
  const now = new Date().toISOString();

  for (let start = 0; start < candidates.length; start += BATCH_SIZE) {
    const batch = candidates.slice(start, start + BATCH_SIZE);
    const targets = batch.map(buildTarget);
    const prompt = renderPrompt(targets);

    // 编号 → 定位
    const index: { itemId: string; field: "title" | "summary" | "point"; index?: number; text: string }[] = [];
    for (const t of targets) {
      for (const slot of t.slots) {
        index.push({ itemId: t.item.id, field: slot.field, index: slot.index, text: slot.text });
      }
    }

    let raw: RawFix[] = [];
    try {
      const parsed = await chatJSON<RawFix[]>(llm, SYSTEM_PROMPT, prompt, {
        timeoutMs: LLM_TIMEOUT,
        maxTokens: 1600,
      });
      if (Array.isArray(parsed)) raw = parsed;
    } catch (err) {
      errors.push(`批次 ${start / BATCH_SIZE + 1} 调用失败：${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    for (const fix of raw) {
      const slot = typeof fix.i === "number" ? index[fix.i] : undefined;
      if (!slot) continue;

      const before = String(fix.before ?? "").trim();
      const after = String(fix.after ?? "").trim();
      const kind = (VALID_KINDS.includes(fix.kind as CorrectionKind) ? fix.kind : "style") as CorrectionKind;
      const item = byId.get(slot.itemId);
      if (!item) continue;

      // 模型偶尔会把「没改」也报上来，这种直接丢弃，不要污染待审队列
      if (!before || before === after) continue;

      // before 必须真的出现在原文里，防止模型编造位置
      if (!before || !slot.text.includes(before)) {
        details.push({
          itemId: slot.itemId,
          itemTitle: item.title,
          field: slot.field,
          kind,
          before,
          after,
          status: "rejected",
          reason: "before 未在原文中出现，可能是编造",
        });
        continue;
      }

      const check = validateFix(slot.field, before, after, kind);
      const status: CorrectionStatus = check.ok ? "applied" : "pending";

      if (check.ok) {
        // 真正应用：只替换 before 片段
        const fixed = slot.text.replace(before, after);
        if (slot.field === "title") item.title = fixed;
        else if (slot.field === "summary") item.summary = fixed;
        else if (slot.field === "point" && typeof slot.index === "number") item.points[slot.index] = fixed;
        item.corrections = (item.corrections ?? 0) + 1;
        // 同步 slot.text，避免同一批次里对同一片段重复替换
        slot.text = fixed;
      }

      newCorrections.push({
        id: hashId(`${slot.itemId}:${slot.field}:${slot.index ?? ""}:${now}:${before.slice(0, 20)}`),
        itemId: slot.itemId,
        itemTitle: item.title,
        field: slot.field,
        index: slot.index,
        before,
        after,
        reason: truncate(String(fix.reason ?? ""), 60) || "自动校对",
        kind,
        status,
        source: "auto",
        blockedBy: check.ok ? undefined : check.reason,
        createdAt: now,
      });

      details.push({
        itemId: slot.itemId,
        itemTitle: item.title,
        field: slot.field,
        kind,
        before,
        after,
        status,
        reason: check.ok ? undefined : check.reason,
      });
    }

    // 这批都算校对过了（哪怕没发现问题），避免下次重复花钱
    for (const t of targets) {
      const live = byId.get(t.item.id);
      if (live) live.proofreadAt = now;
    }
  }

  // 落盘
  const nextItems = stored.map((i) => byId.get(i.id) ?? i);
  const savedItems = await saveItems(nextItems);
  const savedCorrections = await appendCorrections(newCorrections);
  if (!savedItems) errors.push("写回知识库失败，请检查存储配置");
  if (!savedCorrections) errors.push("写入纠错记录失败");

  const applied = details.filter((d) => d.status === "applied").length;
  const pending = details.filter((d) => d.status === "pending").length;

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    checked: candidates.length,
    applied,
    pending,
    llm: true,
    errors,
    details,
  };
}

/** 人工提交的纠错：默认进 pending，等管理台审核 */
export async function submitHumanCorrection(input: {
  itemId: string;
  field: "title" | "summary" | "point";
  index?: number;
  before: string;
  after: string;
  reason?: string;
}): Promise<{ ok: boolean; message: string }> {
  const stored = await getStoredItems();
  const item = stored.find((i) => i.id === input.itemId);
  if (!item) return { ok: false, message: "找不到这条内容（可能是种子内容或已清理）" };

  const before = input.before.trim();
  const after = input.after.trim();
  if (after.length < 1) return { ok: false, message: "请填写正确的文本" };
  if (after.length > MAX_FIELD_LEN) return { ok: false, message: "提交内容过长" };

  // 校验 before 真的在原文里（防止伪造）
  const sourceText =
    input.field === "title"
      ? item.title
      : input.field === "summary"
        ? item.summary
        : item.points[input.index ?? -1] ?? "";
  if (!sourceText) return { ok: false, message: "字段不存在" };
  if (before && !sourceText.includes(before)) {
    return { ok: false, message: "你标记的原文片段不在这条内容里，可能已被修正过，请刷新后重试" };
  }

  const now = new Date().toISOString();
  await appendCorrections([
    {
      id: hashId(`human:${input.itemId}:${input.field}:${now}`),
      itemId: input.itemId,
      itemTitle: item.title,
      field: input.field,
      index: input.index,
      before: before || sourceText,
      after,
      reason: truncate(input.reason ?? "", 80) || "读者反馈",
      kind: "style",
      status: "pending",
      source: "human",
      createdAt: now,
    },
  ]);

  return { ok: true, message: "已收到，管理员审核后会修正。谢谢！" };
}

/** 应用一条 pending 纠错（管理台审核通过时调用） */
export async function applyCorrection(correction: Correction): Promise<{ ok: boolean; message: string }> {
  const stored = await getStoredItems();
  const item = stored.find((i) => i.id === correction.itemId);
  if (!item) return { ok: false, message: "条目已不存在" };

  const sourceText =
    correction.field === "title"
      ? item.title
      : correction.field === "summary"
        ? item.summary
        : item.points[correction.index ?? -1] ?? "";
  if (!sourceText.includes(correction.before)) {
    return { ok: false, message: "原文已变化，这条纠错过期了" };
  }

  const fixed = sourceText.replace(correction.before, correction.after);
  if (correction.field === "title") item.title = fixed;
  else if (correction.field === "summary") item.summary = fixed;
  else if (typeof correction.index === "number") item.points[correction.index] = fixed;
  item.corrections = (item.corrections ?? 0) + 1;

  const saved = await saveItems(stored);
  if (!saved) return { ok: false, message: "写入失败" };
  return { ok: true, message: "已应用" };
}
