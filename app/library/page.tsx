import type { Metadata } from "next";
import Link from "next/link";
import { LIBRARY, LIBRARY_TYPES, type LibraryType } from "@/lib/library";
import { CopyButton } from "@/components/copy-button";

export const metadata: Metadata = {
  title: "模板库：提示词 / Agent / Skill",
  description: "可直接复制的提示词、带步骤的 Agent 方案、含检查项的 Skill 说明书。",
};

const TYPE_LABEL: Record<LibraryType, string> = {
  prompt: "提示词",
  agent: "Agent 方案",
  skill: "Skill",
};

function isType(value: string | string[] | undefined): value is LibraryType {
  return value === "prompt" || value === "agent" || value === "skill";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const active = isType(raw) ? raw : "all";
  const list = active === "all" ? LIBRARY : LIBRARY.filter((i) => i.type === active);

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">模板库</div>
          <h1 className="section-title" style={{ fontSize: "clamp(26px,3.4vw,36px)" }}>
            {LIBRARY.length} 个能直接抄的东西
          </h1>
          <p className="section-desc">
            提示词复制就能用；Agent 方案和 Skill 说明书是「照着做」的流程，不是代码。
            把【】里的内容换成你的即可。
          </p>
        </div>
      </div>

      <div className="tabs">
        <Link href="/library" className={`tab${active === "all" ? " active" : ""}`}>
          全部 {LIBRARY.length}
        </Link>
        {LIBRARY_TYPES.map((type) => {
          const count = LIBRARY.filter((i) => i.type === type.id).length;
          return (
            <Link
              key={type.id}
              href={`/library?type=${type.id}`}
              className={`tab${active === type.id ? " active" : ""}`}
            >
              {type.label} {count}
            </Link>
          );
        })}
      </div>

      {active !== "all" && (
        <p style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 18 }}>
          {LIBRARY_TYPES.find((t) => t.id === active)?.desc}
        </p>
      )}

      <div className="lib-grid">
        {list.map((item) => (
          <div key={item.id} id={item.id} className="lib-card">
            <div className="lib-head">
              <div>
                <span
                  className="badge"
                  style={{
                    background: item.type === "prompt" ? "#eef0ff" : item.type === "agent" ? "#e0f2fe" : "#ecfdf5",
                    color: item.type === "prompt" ? "#4338ca" : item.type === "agent" ? "#0369a1" : "#047857",
                    marginBottom: 8,
                  }}
                >
                  {TYPE_LABEL[item.type]}
                </span>
                <div className="lib-title">{item.title}</div>
              </div>
              <span className="chip">{item.level}</span>
            </div>

            <p className="lib-goal">{item.goal}</p>
            <p className="lib-when">
              <strong>什么时候用：</strong>
              {item.when}
            </p>

            <div className="chips">
              {item.tags.map((tag) => (
                <span key={tag} className="chip">
                  #{tag}
                </span>
              ))}
            </div>

            <details>
              <summary>展开全文</summary>
              <pre className="pre-block">{item.content}</pre>
              <div className="copy-row">
                <CopyButton text={item.content} label="复制全部" />
                <span style={{ fontSize: 12.5, color: "var(--muted-2)" }}>
                  {item.content.length} 字符
                </span>
              </div>
            </details>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-title">复制之后怎么用？</div>
        <p className="card-desc">
          把整段粘进对话框，AI 会按里面的流程走。第一次效果一般很正常 —— 把【】补上具体情况，再让它重写一遍。
          Agent 和 Skill 类内容不需要编程，是写给人看的说明书。
        </p>
        <div className="copy-row">
          <Link href="/learn/skill-basics" className="link-arrow">
            看怎么自己写一个 Skill →
          </Link>
          <Link href="/knowledge?q=提示词" className="link-arrow">
            知识库里的相关条目 →
          </Link>
        </div>
      </div>
    </div>
  );
}
