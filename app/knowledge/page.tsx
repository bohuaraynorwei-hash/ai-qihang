import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_META } from "@/lib/defaults";
import { getConfig, getItems } from "@/lib/store";
import { countByCategory, filterItems, sortByTime } from "@/lib/query";
import { formatDateTime, relTime } from "@/lib/util";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "每日知识库",
  description: "AI 新闻、使用技巧、工具上新、前沿研究，每天自动抓取并写成新手能看懂的人话。",
};

const PAGE_SIZE = 20;
const CATEGORIES: (Category | "all")[] = ["all", "news", "skill", "tool", "research"];

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = asString(sp.q).trim();
  const rawCategory = asString(sp.category) || "all";
  const category = (CATEGORIES as string[]).includes(rawCategory)
    ? (rawCategory as Category | "all")
    : "all";
  const level = asString(sp.level) === "进阶" ? "进阶" : "all";
  const page = Math.max(1, Number(asString(sp.page)) || 1);

  const [items, config] = await Promise.all([getItems(), getConfig()]);
  const filtered = sortByTime(filterItems(items, { q, category, level }));
  const counts = countByCategory(items);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const buildHref = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = { q, category, level, page: String(current), ...patch };
    if (next.q) params.set("q", next.q);
    if (next.category && next.category !== "all") params.set("category", next.category);
    if (next.level && next.level !== "all") params.set("level", next.level);
    if (next.page && next.page !== "1") params.set("page", next.page);
    const qs = params.toString();
    return qs ? `/knowledge?${qs}` : "/knowledge";
  };

  const lastRun = config.lastRun;
  const sources = Array.from(new Set(items.map((i) => i.source)));

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">每日知识库</div>
          <h1 className="section-title" style={{ fontSize: "clamp(26px,3.4vw,36px)" }}>
            今天 AI 圈发生了什么
          </h1>
          <p className="section-desc">
            共 {items.length} 条，来自 {sources.length} 个源。
            {lastRun
              ? ` 最近一次更新：${formatDateTime(lastRun.finishedAt)}（新增 ${lastRun.added} 条）`
              : " 首次自动抓取还没跑，先看下面的冷启动内容。"}
          </p>
        </div>
        <Link href="/feed.xml" className="link-arrow">
          RSS 订阅 →
        </Link>
      </div>

      <form className="kb-toolbar" action="/knowledge" method="get">
        <div className="kb-search">
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="搜标题、摘要、标签，比如「提示词」「Agent」「开源」"
            aria-label="搜索知识库"
          />
          {category !== "all" && <input type="hidden" name="category" value={category} />}
          <button type="submit" className="btn btn-primary btn-sm">
            搜索
          </button>
        </div>
        <div className="chips">
          {CATEGORIES.map((item) => {
            const active = item === category;
            const label = item === "all" ? "全部" : CATEGORY_META[item].label;
            const count = counts[item] || 0;
            return (
              <Link
                key={item}
                href={buildHref({ category: item, page: "1" })}
                className={`chip${active ? " active" : ""}`}
              >
                {label}
                <span style={{ opacity: 0.65, fontSize: 11 }}>{count}</span>
              </Link>
            );
          })}
        </div>
      </form>

      {q && (
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 14 }}>
          搜索「{q}」找到 {filtered.length} 条
          {" · "}
          <Link href="/knowledge">清除</Link>
        </div>
      )}

      {pageItems.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>没找到匹配的内容</div>
          <p style={{ margin: "8px 0 0" }}>
            换个关键词试试，或者
            <Link href="/knowledge"> 看全部条目</Link>。
          </p>
        </div>
      ) : (
        <div className="kb-list">
          {pageItems.map((item) => {
            const meta = CATEGORY_META[item.category];
            return (
              <article key={item.id} className="kb-item">
                <div className="kb-item-top">
                  <span className="badge" style={{ background: "var(--bg-soft)", color: meta.color }}>
                    {meta.label}
                  </span>
                  <span>{item.source}</span>
                  <span>·</span>
                  <time dateTime={item.publishedAt}>{relTime(item.publishedAt)}</time>
                  <span>·</span>
                  <span>{item.level}</span>
                </div>
                <Link href={`/knowledge/${item.id}`} className="kb-title">
                  {item.title}
                </Link>
                <p className="kb-summary">{item.summary}</p>
                {item.points.length > 0 && (
                  <ul className="kb-points">
                    {item.points.slice(0, 3).map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
                <div className="card-meta" style={{ marginTop: 12 }}>
                  {item.tags.map((tag) => (
                    <Link key={tag} href={buildHref({ q: tag, page: "1" })} className="chip">
                      #{tag}
                    </Link>
                  ))}
                  <a href={item.url} target="_blank" rel="noreferrer noopener" className="link-arrow">
                    阅读原文 ↗
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 26 }}>
          {current > 1 && (
            <Link href={buildHref({ page: String(current - 1) })} className="btn btn-line btn-sm">
              ← 上一页
            </Link>
          )}
          <span style={{ alignSelf: "center", fontSize: 13, color: "var(--muted)" }}>
            第 {current} / {totalPages} 页
          </span>
          {current < totalPages && (
            <Link href={buildHref({ page: String(current + 1) })} className="btn btn-line btn-sm">
              下一页 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
