import type { Metadata } from "next";
import Link from "next/link";
import { LESSONS, TOTAL_MINUTES } from "@/lib/curriculum";
import { DoneBadge, ProgressPill } from "@/components/progress";

export const metadata: Metadata = {
  title: "学习路径",
  description:
    "从「AI 能帮我做什么」到设计 Agent 和 Skill，再到用 DeepSeek Harness + Codex 做本地化。每节 10-18 分钟，配练习。",
};

const DEFAULT_TRACK = "AI 基础入门";
const TRACK_ORDER = [DEFAULT_TRACK, "进阶深化", "工具生态", "本地化专题", "多语言对照翻译", "增量本地化"];

const TRACK_DESC: Record<string, string> = {
  [DEFAULT_TRACK]: "顺序按难度排好了。每节课末尾都有练习 —— 只看不练，等于没学。",
  进阶深化: "基础之上的四个进阶杠杆：系统提示词、结构化输出、Agent 运维、Skill 版本管理。",
  工具生态: "Hook / Skill / MCP / 插件到底差在哪，以及怎么定期清理挂件、让 AI 保持灵敏。",
  本地化专题: "用 AI 做翻译、术语管理、质检：从「翻译 ≠ 本地化」到「代码级本地化」。基于 DeepSeek Harness 与 Codex。",
  多语言对照翻译: "一份源文翻译成 N 种语言：对照表、批量脚本、多语言质检与交付清单。",
  增量本地化: "专业生产流水线：全量表 + 术语表 + 风格指导 + checklist 组合生成增量翻译，独立 QA 与锁定回写。",
};

export default function LearnPage() {
  const hours = Math.round((TOTAL_MINUTES / 60) * 10) / 10;

  const groups = TRACK_ORDER.map((name) => ({
    name,
    desc: TRACK_DESC[name] || "",
    lessons: LESSONS.filter((l) => (l.track ?? DEFAULT_TRACK) === name),
  })).filter((g) => g.lessons.length > 0);

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="section-head" style={{ alignItems: "center" }}>
        <div>
          <div className="eyebrow">学习路径</div>
          <h1 className="section-title" style={{ fontSize: "clamp(26px,3.4vw,36px)" }}>
            从零到会用：{LESSONS.length} 节课
          </h1>
          <p className="section-desc">
            两个专题：先打好「提示词 / Agent / Skill」的基础，再进本地化实战。共约 {hours} 小时。
          </p>
        </div>
        <ProgressPill total={LESSONS.length} />
      </div>

      {groups.map((group) => (
        <section key={group.name} style={{ marginTop: 28 }}>
          <div
            className="section-head"
            style={{ marginBottom: 14, alignItems: "baseline", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}
          >
            <div>
              <h2 className="section-title" style={{ fontSize: 20 }}>
                {group.name}
              </h2>
              <p className="section-desc" style={{ fontSize: 14, marginTop: 4 }}>
                {group.desc}
              </p>
            </div>
            <span className="chip" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
              {group.lessons.length} 节课
            </span>
          </div>

          <div className="lesson-list">
            {group.lessons.map((lesson) => (
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
        </section>
      ))}

      <div className="card" style={{ marginTop: 28, background: "linear-gradient(120deg,#f5f3ff,#fff)" }}>
        <div className="card-title">不知道从哪开始？</div>
        <p className="card-desc">
          如果你只有 15 分钟：先读第 1 课，然后照着「第一个 10 分钟练习」把你今天本来要写的一段文字交给
          AI 做一遍。这比读完所有课有用。要做本地化，直接进「本地化专题」第 1 课。
        </p>
        <div className="copy-row">
          <Link href="/learn/start-here" className="btn btn-primary btn-sm">
            直接进第 1 课
          </Link>
          <Link href="/learn/l10n-basics" className="btn btn-line btn-sm">
            本地化专题 →
          </Link>
          <Link href="/library" className="btn btn-line btn-sm">
            先看模板库
          </Link>
        </div>
      </div>
    </div>
  );
}
