import type { Metadata } from "next";
import Link from "next/link";
import { LESSONS, TOTAL_MINUTES } from "@/lib/curriculum";
import { DoneBadge, ProgressPill } from "@/components/progress";

export const metadata: Metadata = {
  title: "学习路径",
  description:
    "从「AI 能帮我做什么」到设计 Agent 和 Skill，再到用 DeepSeek Harness + Codex 做本地化。每节 10-18 分钟，配练习。",
};

const DEFAULT_TRACK = "01 · AI 基本功";
const TRACK_ORDER = [
  DEFAULT_TRACK,
  "02 · 翻译与术语",
  "03 · 多语言批量",
  "04 · 增量流水线",
  "05 · 自动化进阶",
];

const TRACK_DESC: Record<string, string> = {
  [DEFAULT_TRACK]: "本地化的人也需要先会用 AI。这几节只讲干活用得上的：提问、上下文、安全边界。",
  "02 · 翻译与术语": "从「翻译 ≠ 本地化」到术语表、上下文翻译、机翻校订，最后用 Codex 落到文件里。",
  "03 · 多语言批量": "一份源文翻成 N 种语言：对照表、批量脚本、多语言质检与交付清单。",
  "04 · 增量流水线": "专业生产流水线：全量表 + 术语表 + 风格指导 + checklist 生成增量，独立 QA 与锁定回写。",
  "05 · 自动化进阶": "让流程自己跑：Agent、工具权限、Skill 版本、Hook/Skill/MCP/插件怎么选，以及定期清理挂件。",
};

const TRACK_GOAL: Record<string, string> = {
  [DEFAULT_TRACK]: "能独立完成一次「把小事交给 AI」",
  "02 · 翻译与术语": "能交付一份术语一致、占位符完整的译文",
  "03 · 多语言批量": "能一次产出多语言对照表并自检",
  "04 · 增量流水线": "能跑通「增量→翻译→QA→锁定」全流程",
  "05 · 自动化进阶": "能把重复环节交给流程，并保持环境干净",
};

export default function LearnPage() {
  const hours = Math.round((TOTAL_MINUTES / 60) * 10) / 10;

  const groups = TRACK_ORDER.map((name) => ({
    name,
    desc: TRACK_DESC[name] || "",
    goal: TRACK_GOAL[name] || "",
    lessons: LESSONS.filter((l) => (l.track ?? DEFAULT_TRACK) === name),
  })).filter((g) => g.lessons.length > 0);

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="section-head" style={{ alignItems: "center" }}>
        <div>
          <div className="eyebrow">学习路径</div>
          <h1 className="section-title" style={{ fontSize: "clamp(26px,3.4vw,36px)" }}>
            一条路走完：{LESSONS.length} 节课 · 5 个阶段
          </h1>
          <p className="section-desc">
            只讲游戏本地化要用的。从「会用 AI」到「能跑增量流水线」，顺序已排好，共约 {hours} 小时。
          </p>
        </div>
        <ProgressPill total={LESSONS.length} />
      </div>

      {groups.map((group, gi) => (
        <section key={group.name} style={{ marginTop: 28 }}>
          <div
            className="section-head"
            style={{ marginBottom: 14, alignItems: "baseline", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span
                style={{
                  flex: "none",
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#fff",
                  background: "linear-gradient(135deg,#4f46e5,#0ea5e9)",
                  marginTop: 2,
                }}
              >
                {gi + 1}
              </span>
              <div>
                <h2 className="section-title" style={{ fontSize: 20 }}>
                  {group.name}
                </h2>
                <p className="section-desc" style={{ fontSize: 14, marginTop: 4 }}>
                  {group.desc}
                </p>
                {group.goal && (
                  <p style={{ fontSize: 13, marginTop: 6, color: "var(--brand)", fontWeight: 600 }}>
                    学完能做到：{group.goal}
                  </p>
                )}
              </div>
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
