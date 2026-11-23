import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LESSONS, neighbors } from "@/lib/curriculum";
import { extractHeadings, renderMarkdown } from "@/lib/markdown";
import { MarkDone } from "@/components/progress";

export function generateStaticParams() {
  return LESSONS.map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = LESSONS.find((l) => l.slug === slug);
  if (!lesson) return { title: "课程不存在" };
  return {
    title: lesson.title,
    description: `${lesson.subtitle}。${lesson.goals.join("；")}。`,
  };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = LESSONS.find((l) => l.slug === slug);
  if (!lesson) notFound();

  const html = renderMarkdown(lesson.markdown);
  const headings = extractHeadings(lesson.markdown);
  const { prev, next } = neighbors(slug);

  return (
    <div className="container" style={{ paddingTop: 36 }}>
      <div style={{ fontSize: 13, color: "var(--muted-2)", marginBottom: 14 }}>
        <Link href="/learn">← 学习路径</Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <span>
          第 {lesson.index} 课 · {lesson.minutes} 分钟 · {lesson.level}
        </span>
      </div>

      <div className="lesson-layout">
        <article>
          <header style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: "clamp(26px,3.6vw,38px)", fontWeight: 850, letterSpacing: "-0.02em" }}>
              {lesson.title}
            </h1>
            <p className="section-desc" style={{ fontSize: 16.5 }}>
              {lesson.subtitle}
            </p>
            <div className="card" style={{ marginTop: 18, background: "#f8f9ff", borderColor: "#e3e6f8" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>学完这节课，你能做到</div>
              <ul className="kb-points" style={{ marginTop: 8 }}>
                {lesson.goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
          </header>

          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

          <MarkDone slug={lesson.slug} />

          <nav
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              marginTop: 32,
              flexWrap: "wrap",
            }}
          >
            {prev ? (
              <Link href={`/learn/${prev.slug}`} className="btn btn-line">
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/learn/${next.slug}`} className="btn btn-primary">
                {next.title} →
              </Link>
            ) : (
              <Link href="/library" className="btn btn-primary">
                去模板库 →
              </Link>
            )}
          </nav>
        </article>

        <aside className="toc">
          <h4>本课目录</h4>
          <ol style={{ listStyle: "none", paddingLeft: 0 }}>
            {headings.map((h) => (
              <li key={h.id} style={{ paddingLeft: h.level === 3 ? 14 : 0 }}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ol>
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--muted-2)", marginBottom: 8 }}>全部课程</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {LESSONS.filter((l) => l.slug !== lesson.slug)
                .slice(0, 6)
                .map((l) => (
                  <Link
                    key={l.slug}
                    href={`/learn/${l.slug}`}
                    style={{ fontSize: 13, color: "var(--ink-soft)" }}
                  >
                    {l.index}. {l.title}
                  </Link>
                ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
