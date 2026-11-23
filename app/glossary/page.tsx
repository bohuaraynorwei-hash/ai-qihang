import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "AI 术语表",
  description: "26 个最常遇到的 AI 术语，每个都用一句人话解释，配一句「你该知道什么」。",
};

export default async function GlossaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q || "").trim().toLowerCase();
  const list = q
    ? GLOSSARY.filter((term) =>
        [term.term, term.en || "", term.short, term.detail, ...(term.tags || [])]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : GLOSSARY;

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">术语表</div>
          <h1 className="section-title" style={{ fontSize: "clamp(26px,3.4vw,36px)" }}>
            听不懂的时候，来这里查
          </h1>
          <p className="section-desc">
            {GLOSSARY.length} 个术语，每个先给一句话人话版，再补一句「实际影响」。
            读完不用记住，知道去哪儿查就够了。
          </p>
        </div>
        <Link href="/library" className="link-arrow">
          模板库 →
        </Link>
      </div>

      <div className="gloss-tools">
        <form action="/glossary" method="get" className="kb-search" style={{ flex: "1 1 320px" }}>
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="搜术语，比如 token、RAG、幻觉"
            aria-label="搜索术语"
          />
          <button type="submit" className="btn btn-primary btn-sm">
            搜索
          </button>
        </form>
        {q && (
          <Link href="/glossary" className="btn btn-line btn-sm">
            清除
          </Link>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty">没有匹配的术语。换个说法试试，比如「模型」「检索」「安全」。</div>
      ) : (
        <div className="gloss-list">
          {list.map((term) => (
            <div key={term.term} className="gloss-item" id={term.term}>
              <div className="gloss-term">
                {term.term}
                {term.en && <small>{term.en}</small>}
              </div>
              <div className="gloss-short">{term.short}</div>
              <p className="gloss-detail">{term.detail}</p>
              {term.tags && term.tags.length > 0 && (
                <div className="chips" style={{ marginTop: 10 }}>
                  {term.tags.map((tag) => (
                    <Link key={tag} href={`/glossary?q=${encodeURIComponent(tag)}`} className="chip">
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
