import Link from "next/link";
import { CATEGORY_META } from "@/lib/defaults";
import { LESSONS, TOTAL_MINUTES } from "@/lib/curriculum";
import { LIBRARY } from "@/lib/library";
import { getConfig, getItems } from "@/lib/store";
import { sortByTime } from "@/lib/query";
import { formatDateTime, relTime } from "@/lib/util";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

const TRACKS = [
  {
    icon: "✎",
    title: "提示词",
    desc: "同一个模型，会问和不会问差 5 倍。六段式模板 + 三个进阶杠杆。",
    href: "/learn/prompt-basics",
    badge: "第 2-3 课",
  },
  {
    icon: "⚙",
    title: "Agent",
    desc: "从「会聊天」到「会干活」：目标、工具、循环、记忆，以及什么时候别用。",
    href: "/learn/agent-basics",
    badge: "第 5-6 课",
  },
  {
    icon: "❖",
    title: "Skill",
    desc: "把用过 3 次以上的提示词，变成同事也能直接调用的技能包。",
    href: "/learn/skill-basics",
    badge: "第 7 课",
  },
];

const STEPS = [
  { day: "今天", title: "先做一件小事", desc: "用 AI 写完一封你本来要写的邮件" },
  { day: "第 1 周", title: "把话说清楚", desc: "掌握六段式提示词，能写出稳定可用的指令" },
  { day: "第 3 周", title: "让 AI 动手", desc: "理解 Agent 与工具权限，写出第一个 skill" },
  { day: "第 30 天", title: "接进日常", desc: "四条流水线跑起来，幻觉与隐私有底线" },
];

export default async function HomePage() {
  const [items, config] = await Promise.all([getItems(), getConfig()]);
  const latest = sortByTime(items).slice(0, 4);
  const lastRun = config.lastRun;
  const enabledSources = config.sources.filter((s) => s.enabled);
  const hotPrompts = LIBRARY.filter((i) => i.type === "prompt").slice(0, 3);
  const totalHours = Math.round((TOTAL_MINUTES / 60) * 10) / 10;

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <span className="hero-kicker">
              <i />
              知识库每日自动更新
              {lastRun ? ` · 最近一次 ${relTime(lastRun.finishedAt)}` : " · 等待首次抓取"}
            </span>
            <h1 className="hero-title">
              不懂技术，也能<em>真正会用 AI</em>
            </h1>
            <p className="hero-desc">
              从「帮我写个方案」到能设计自己的 Agent 和 Skill。
              {LESSONS.length} 节课、{LIBRARY.length} 个可直接复制的模板，配一个每天自动更新的 AI
              知识库 —— 不用追进度，一天 15 分钟就够。
            </p>
            <div className="hero-actions">
              <Link href="/learn/start-here" className="btn btn-primary">
                从第一课开始 →
              </Link>
              <Link href="/knowledge" className="btn btn-ghost">
                看看今天更新了什么
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-num">{LESSONS.length} 节</div>
                <div className="stat-label">课程 · 约 {totalHours} 小时</div>
              </div>
              <div className="stat">
                <div className="stat-num">{items.length} 条</div>
                <div className="stat-label">知识库条目</div>
              </div>
              <div className="stat">
                <div className="stat-num">{LIBRARY.length} 个</div>
                <div className="stat-label">提示词 / Agent / Skill</div>
              </div>
              <div className="stat">
                <div className="stat-num">每日</div>
                <div className="stat-label">{enabledSources.length} 个源自动抓取</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">三条主线</div>
              <h2 className="section-title">学什么，先说清楚</h2>
              <p className="section-desc">
                不堆概念。每条主线都从「你今天会遇到的具体问题」出发，学完就能用。
              </p>
            </div>
            <Link href="/learn" className="link-arrow">
              全部课程 →
            </Link>
          </div>
          <div className="grid grid-3">
            {TRACKS.map((track) => (
              <Link key={track.title} href={track.href} className="card hoverable">
                <div className="card-icon">{track.icon}</div>
                <div className="card-title">{track.title}</div>
                <p className="card-desc">{track.desc}</p>
                <div className="card-meta">
                  <span className="chip">{track.badge}</span>
                  <span>开始读 →</span>
                </div>
              </Link>
            ))}
          </div>

          <Link
            href="/learn/l10n-basics"
            className="card hoverable"
            style={{
              marginTop: 18,
              background: "linear-gradient(120deg,#eef2ff,#f5f3ff)",
              borderColor: "#dfe3f8",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="eyebrow">新增专题 · 6 节课</div>
                <div className="card-title">语言本地化（i18n / l10n）</div>
                <p className="card-desc">
                  用 DeepSeek Harness + Codex 做翻译、术语管理、质检：从「翻译 ≠ 本地化」到「代码级本地化」的完整新手实战课。
                </p>
              </div>
              <span className="btn btn-primary btn-sm">开始学 →</span>
            </div>
          </Link>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">学习节奏</div>
              <h2 className="section-title">一个月，从会问到会用</h2>
              <p className="section-desc">
                不用脱产。每天 15 分钟，按顺序做，第 30 天你会有一份自己的 AI 使用说明。
              </p>
            </div>
            <Link href="/learn" className="link-arrow">
              完整计划 →
            </Link>
          </div>
          <div className="grid grid-4">
            {STEPS.map((step) => (
              <div key={step.day} className="card">
                <span className="chip" style={{ alignSelf: "flex-start" }}>
                  {step.day}
                </span>
                <div className="card-title" style={{ fontSize: 16 }}>
                  {step.title}
                </div>
                <p className="card-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">今日知识库</div>
              <h2 className="section-title">别人踩过的坑，你不用再踩</h2>
              <p className="section-desc">
                每天从 {enabledSources.length} 个公开源自动抓取，只保留和「怎么用」有关的部分，写成人话。
              </p>
            </div>
            <Link href="/knowledge" className="link-arrow">
              看全部 {items.length} 条 →
            </Link>
          </div>
          <div className="kb-list">
            {latest.map((item) => {
              const meta = CATEGORY_META[item.category];
              return (
                <Link key={item.id} href={`/knowledge/${item.id}`} className="kb-item">
                  <div className="kb-item-top">
                    <span className="badge" style={{ background: "var(--bg-soft)", color: meta.color }}>
                      {meta.label}
                    </span>
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{relTime(item.publishedAt)}</span>
                  </div>
                  <div className="kb-title">{item.title}</div>
                  <p className="kb-summary">{item.summary}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">拿来就用</div>
              <h2 className="section-title">三个今天就能复制的模板</h2>
              <p className="section-desc">
                把【】里的内容换成你的，直接粘进任意 AI 对话框。模板库还有更多。
              </p>
            </div>
            <Link href="/library" className="link-arrow">
              模板库 →
            </Link>
          </div>
          <div className="grid grid-3">
            {hotPrompts.map((item) => (
              <div key={item.id} className="card">
                <div className="card-title">{item.title}</div>
                <p className="card-desc">{item.goal}</p>
                <div className="card-meta">
                  {item.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="copy-row">
                  <CopyButton text={item.content} label="复制提示词" />
                  <Link href={`/library#${item.id}`} className="link-arrow">
                    看说明
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="card" style={{ background: "linear-gradient(120deg,#0b1024,#1c2450)" }}>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>
              每天更新的内容，从哪来？
            </div>
            <p style={{ color: "#b9c2dd", margin: "8px 0 14px", fontSize: 14.5 }}>
              不做二次搬运。定时任务抓取公开 RSS，交给大模型写成新手能懂的摘要，保留原文链接，全部可追溯。
              {lastRun
                ? ` 上次运行：${formatDateTime(lastRun.finishedAt)}，新增 ${lastRun.added} 条，用时 ${Math.round(
                    lastRun.durationMs / 1000
                  )} 秒。`
                : " 首次抓取还没跑，可以在管理台手动触发。"}
            </p>
            <div className="chips">
              {enabledSources.map((s) => (
                <span
                  key={s.id}
                  className="chip"
                  style={{ background: "rgba(255,255,255,.08)", color: "#dfe5ff" }}
                >
                  {s.name}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 18 }}>
              <Link href="/knowledge" className="btn btn-primary btn-sm">
                进入知识库
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
