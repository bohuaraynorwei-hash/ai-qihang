import type { Metadata } from "next";
import Link from "next/link";
import { LESSONS, TOTAL_MINUTES } from "@/lib/curriculum";
import { DoneBadge, ProgressPill } from "@/components/progress";

export const metadata: Metadata = {
  title: "学习路径",
  description:
    "10 节课，从「AI 能帮我做什么」到设计自己的 Agent 和 Skill。每节 10-18 分钟，配练习。",
};

export default function LearnPage() {
  const hours = Math.round((TOTAL_MINUTES / 60) * 10) / 10;

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="section-head" style={{ alignItems: "center" }}>
        <div>
          <div className="eyebrow">学习路径</div>
          <h1 className="section-title" style={{ fontSize: "clamp(26px,3.4vw,36px)" }}>
            从零到会用：10 节课
          </h1>
          <p className="section-desc">
            顺序按难度排好了，不用挑。每节课末尾都有练习 —— 只看不练，等于没学。共约 {hours} 小时。
          </p>
        </div>
        <ProgressPill total={LESSONS.length} />
      </div>

      <div className="lesson-list">
        {LESSONS.map((lesson) => (
          <div key={lesson.slug} className="lesson-item">
            <div className="lesson-index">{String(lesson.index).padStart(2, "0")}</div>
            <div className="lesson-body">
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Link href={`/learn/${lesson.slug}`} className="lesson-name">
                  {lesson.title}
                </Link>
                <DoneBadge slug={lesson.slug} />
              </div>
              <div className="lesson-sub">{lesson.subtitle}</div>
              <div className="lesson-meta">
                <span className="chip">{lesson.minutes} 分钟</span>
                <span className="chip">{lesson.level}</span>
                {lesson.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="chip" style={{ background: "#fff", border: "1px solid var(--line)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <Link href={`/learn/${lesson.slug}`} className="link-arrow" style={{ alignSelf: "center" }}>
              开始 →
            </Link>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 28, background: "linear-gradient(120deg,#f5f3ff,#fff)" }}>
        <div className="card-title">不知道从哪开始？</div>
        <p className="card-desc">
          如果你只有 15 分钟：先读第 1 课，然后照着「第一个 10 分钟练习」把你今天本来要写的一段文字交给
          AI 做一遍。这比读完所有课有用。
        </p>
        <div className="copy-row">
          <Link href="/learn/start-here" className="btn btn-primary btn-sm">
            直接进第 1 课
          </Link>
          <Link href="/library" className="btn btn-line btn-sm">
            先看模板库
          </Link>
        </div>
      </div>
    </div>
  );
}
