import Link from "next/link";
import { LESSONS, TOTAL_MINUTES } from "@/lib/curriculum";
import { LIBRARY } from "@/lib/library";
import { GLOSSARY } from "@/lib/glossary";
import { getConfig, getItems } from "@/lib/store";
import { sortByTime } from "@/lib/query";
import { relTime } from "@/lib/util";
import { CATEGORY_META } from "@/lib/defaults";
import { CopyButton } from "@/components/copy-button";
import { LevelQuiz } from "@/components/level-quiz";

export const dynamic = "force-dynamic";

/** 三档入口：按水平分流，不按岗位分类 */
const TIERS = [
  {
    emoji: "🌱",
    title: "第一次用 AI",
    desc: "没用过也没关系。第 1 课就让你用 AI 完成一件真实的小事，15 分钟出结果。",
    href: "/learn/start-here",
    meta: "01 基本功 · 10 节课",
    cta: "从第 1 课开始",
  },
  {
    emoji: "🚀",
    title: "已经在做本地化",
    desc: "术语漂移、占位符丢失、翻完还要人工对一遍——这些都有对应的流程和模板。",
    href: "/learn/l10n-basics",
    meta: "02 翻译与术语 · 6 节课",
    cta: "进翻译实战",
  },
  {
    emoji: "💡",
    title: "想搭一条流水线",
    desc: "只翻增量、独立 QA、锁定回写。附一套能直接跑的 Python 工具包和演示数据。",
    href: "/learn/inc-full-vs-delta",
    meta: "04 增量流水线 · 6 节课",
    cta: "进增量流水线",
  },
];

const PHASES = [
  { no: "01", name: "AI 基本功", desc: "只会用干活用得上的部分", href: "/learn" },
  { no: "02", name: "翻译与术语", desc: "术语表、上下文、机翻校订", href: "/learn/l10n-basics" },
  { no: "03", name: "多语言批量", desc: "对照表、分批脚本、多语言质检", href: "/learn/mlt-parallel" },
  { no: "04", name: "增量流水线", desc: "增量、独立 QA、锁定回写", href: "/learn/inc-full-vs-delta" },
  { no: "05", name: "自动化进阶", desc: "Agent、Skill、挂件清理", href: "/learn/agent-basics" },
];

export default async function HomePage() {
  const [items, config] = await Promise.all([getItems(), getConfig()]);
  const latest = sortByTime(items).slice(0, 3);
  const lastRun = config.lastRun;
  const enabledSources = config.sources.filter((s) => s.enabled);
  const totalHours = Math.round((TOTAL_MINUTES / 60) * 10) / 10;

  // 本地化相关模板（含多语言与增量）
  const l10nPrompts = LIBRARY.filter(
    (i) => i.tags.includes("本地化") || i.tags.includes("多语言") || i.tags.includes("增量")
  );
  const featured = ["prompt-l10n-glossary", "prompt-l10n-translate", "prompt-inc-generate"]
    .map((id) => LIBRARY.find((i) => i.id === id))
    .filter((x): x is (typeof LIBRARY)[number] => Boolean(x));

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <span className="hero-kicker">
              <i />
              面向游戏本地化 · 知识库每日自动更新
              {lastRun ? ` · 最近一次 ${relTime(lastRun.finishedAt)}` : ""}
            </span>
            <h1 className="hero-title">
              把本地化从手工活，
              <br />
              变成<em>能跑的流水线</em>
            </h1>
            <p className="hero-desc">
              只讲游戏本地化要用的：术语表、上下文翻译、多语言对照、增量与质检。
              {LESSONS.length} 节课走完一条路，配 {l10nPrompts.length} 个能直接复制的模板，
              和一套现成的增量流水线工具。
            </p>
            <div className="hero-actions">
              <Link href="/learn/start-here" className="btn btn-primary">
                从第 1 课开始 →
              </Link>
              <a href="#quiz" className="btn btn-ghost">
                3 个问题，找到我的起点
              </a>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-num">{LESSONS.length} 节</div>
                <div className="stat-label">5 个阶段 · 约 {totalHours} 小时</div>
              </div>
              <div className="stat">
                <div className="stat-num">{l10nPrompts.length} 个</div>
                <div className="stat-label">本地化模板（含别用场景）</div>
              </div>
              <div className="stat">
                <div className="stat-num">{GLOSSARY.length} 条</div>
                <div className="stat-label">术语 · 人话解释</div>
              </div>
              <div className="stat">
                <div className="stat-num">{items.length} 条</div>
                <div className="stat-label">{enabledSources.length} 个源每日抓取</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {/* 三档入口 */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">选一个起点</div>
              <h2 className="section-title">按自己的水平进来</h2>
              <p className="section-desc">
                不分岗位、不挑方向——本地化就一条路。你只需要选自己现在在哪一档。
              </p>
            </div>
            <Link href="/learn" className="link-arrow">
              看完整路径 →
            </Link>
          </div>
          <div className="grid grid-3">
            {TIERS.map((tier) => (
              <Link key={tier.title} href={tier.href} className="tier-card">
                <span className="tier-emoji">{tier.emoji}</span>
                <div className="tier-title">{tier.title}</div>
                <p className="tier-desc">{tier.desc}</p>
                <div className="tier-meta">
                  <span className="chip">{tier.meta}</span>
                  <span style={{ color: "var(--brand)", fontWeight: 700 }}>{tier.cta} →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 诊断 */}
        <section className="section" id="quiz">
          <div className="section-head">
            <div>
              <div className="eyebrow">不确定从哪开始？</div>
              <h2 className="section-title">3 个问题，1 分钟</h2>
              <p className="section-desc">
                按你现在的实际情况答，直接推荐一个起点。测完会告诉你去哪一节。
              </p>
            </div>
          </div>
          <div style={{ maxWidth: 640 }}>
            <LevelQuiz />
          </div>
        </section>

        {/* 五阶段 */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">一条路走完</div>
              <h2 className="section-title">5 个阶段，顺序已经排好</h2>
              <p className="section-desc">
                不用挑、不用跳。每个阶段都写清了「学完能做到什么」。
              </p>
            </div>
            <Link href="/learn" className="link-arrow">
              全部 {LESSONS.length} 节课 →
            </Link>
          </div>
          <div className="grid grid-3">
            {PHASES.map((phase) => (
              <Link key={phase.no} href={phase.href} className="card hoverable">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span
                    style={{
                      flex: "none",
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#fff",
                      background: "linear-gradient(135deg,#4f46e5,#0ea5e9)",
                    }}
                  >
                    {phase.no}
                  </span>
                  <div className="card-title" style={{ fontSize: 16 }}>
                    {phase.name}
                  </div>
                </div>
                <p className="card-desc">{phase.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* 模板精选 */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">拿来就用</div>
              <h2 className="section-title">每个模板都写了「什么时候别用」</h2>
              <p className="section-desc">
                只给「什么时候用」的模板会害人。我们连不该用的场景一起写清楚，避免你照抄进坑里。
              </p>
            </div>
            <Link href="/library" className="link-arrow">
              全部 {LIBRARY.length} 个模板 →
            </Link>
          </div>
          <div className="grid grid-3">
            {featured.map((item) => (
              <div key={item.id} className="card">
                <div className="card-title" style={{ fontSize: 16 }}>
                  {item.title}
                </div>
                <p className="card-desc">{item.goal}</p>
                {item.whenNot && (
                  <p className="lib-when lib-whennot" style={{ fontSize: 12.5 }}>
                    <strong>❌ 别用：</strong>
                    {item.whenNot}
                  </p>
                )}
                <div className="copy-row" style={{ marginTop: "auto" }}>
                  <CopyButton text={item.content} label="复制" />
                  <Link href={`/library#${item.id}`} className="link-arrow">
                    看全文
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 每日情报 */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">每日情报</div>
              <h2 className="section-title">AI 圈的新东西，挑跟你有关的</h2>
              <p className="section-desc">
                每天从 {enabledSources.length} 个公开源抓取，用大模型写成中文摘要，只保留和「怎么用」有关的部分。
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

        {/* 工具包 */}
        <section className="section">
          <div
            className="card"
            style={{ background: "linear-gradient(120deg,#0b1024,#1c2450)", borderColor: "#232c55" }}
          >
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>
              增量本地化工具包（可下载）
            </div>
            <p style={{ color: "#b9c2dd", margin: "10px 0 16px", fontSize: 14.5, maxWidth: 720 }}>
              算增量 → 四件套翻译 → 机检 QA → 锁定回写，一条命令跑完。
              带演示数据（全量表 + 新版源文 + 术语表 + 风格指导），改配置就能对你们自己的语言表用。
            </p>
            <div className="chips" style={{ marginBottom: 18 }}>
              {["Python 单文件", "只需 openpyxl", "16 项机检规则", "幂等可重跑"].map((tag) => (
                <span key={tag} className="chip" style={{ background: "rgba(255,255,255,.08)", color: "#dfe5ff" }}>
                  {tag}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href="/downloads/incremental-l10n.zip"
                className="btn btn-primary btn-sm"
                download
              >
                下载工具包
              </a>
              <Link href="/learn/inc-lock" className="btn btn-ghost btn-sm">
                看怎么用 →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
