import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_META } from "@/lib/defaults";
import { getItems } from "@/lib/store";
import { sortByTime } from "@/lib/query";
import { formatDateTime } from "@/lib/util";
import { ReportError } from "@/components/report-error";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const items = await getItems();
  const item = items.find((i) => i.id === id);
  if (!item) return { title: "条目不存在" };
  return { title: item.title, description: item.summary };
}

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const items = await getItems();
  const item = items.find((i) => i.id === id);
  if (!item) notFound();

  const meta = CATEGORY_META[item.category];
  const related = sortByTime(
    items.filter((i) => i.id !== item.id && (i.category === item.category || i.tags.some((t) => item.tags.includes(t))))
  ).slice(0, 4);

  return (
    <div className="container" style={{ paddingTop: 36, maxWidth: 860 }}>
      <div style={{ fontSize: 13, color: "var(--muted-2)", marginBottom: 16 }}>
        <Link href="/knowledge">← 知识库</Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <span>{meta.label}</span>
      </div>

      <article>
        <div className="kb-item-top" style={{ marginBottom: 12 }}>
          <span className="badge" style={{ background: "var(--bg-soft)", color: meta.color }}>
            {meta.label}
          </span>
          <span>{item.source}</span>
          <span>·</span>
          <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
          <span>·</span>
          <span>{item.level}</span>
          {item.proofreadAt && (
            <span className="proofread-badge" title={`自动校对于 ${formatDateTime(item.proofreadAt)}`}>
              ✓ 已校对
              {item.corrections ? ` · 修正 ${item.corrections} 处` : ""}
            </span>
          )}
        </div>

        <h1 style={{ fontSize: "clamp(25px,3.4vw,34px)", fontWeight: 850, letterSpacing: "-0.02em" }}>
          {item.title}
        </h1>

        <p style={{ fontSize: 17, lineHeight: 1.8, color: "#2a3247", marginTop: 16 }}>{item.summary}</p>

        {item.points.length > 0 && (
          <div className="card" style={{ marginTop: 22, background: "#f8f9ff", borderColor: "#e3e6f8" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>能带走的三件事</div>
            <ul className="kb-points" style={{ marginTop: 10 }}>
              {item.points.map((point) => (
                <li key={point} style={{ fontSize: 15 }}>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card-meta" style={{ marginTop: 22 }}>
          {item.tags.map((tag) => (
            <Link key={tag} href={`/knowledge?q=${encodeURIComponent(tag)}`} className="chip">
              #{tag}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
          <a href={item.url} target="_blank" rel="noreferrer noopener" className="btn btn-primary">
            阅读原文 ↗
          </a>
          <Link href="/knowledge" className="btn btn-line">
            回知识库
          </Link>
        </div>

        <div className="alert alert-info" style={{ marginTop: 26 }}>
          这条摘要由大模型基于原文生成，可能有偏差。涉及具体数字、政策、价格时，请点开原文核对。
          原文版权归 <strong>{item.source}</strong> 所有。
        </div>

        <ReportError itemId={item.id} title={item.title} summary={item.summary} points={item.points} />
      </article>

      {related.length > 0 && (
        <section style={{ marginTop: 44 }}>
          <div className="eyebrow">相关阅读</div>
          <div className="kb-list" style={{ marginTop: 14 }}>
            {related.map((rel) => (
              <Link key={rel.id} href={`/knowledge/${rel.id}`} className="kb-item">
                <div className="kb-item-top">
                  <span className="badge" style={{ background: "var(--bg-soft)", color: CATEGORY_META[rel.category].color }}>
                    {CATEGORY_META[rel.category].label}
                  </span>
                  <span>{rel.source}</span>
                </div>
                <div className="kb-title" style={{ fontSize: 16.5 }}>
                  {rel.title}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
