"use client";

import Link from "next/link";
import { useState } from "react";

interface Option {
  label: string;
  /** 0=纯新手 1=会一点 2=在实战 3=要自动化 */
  level: 0 | 1 | 2 | 3;
}

interface Question {
  q: string;
  options: Option[];
}

const QUESTIONS: Question[] = [
  {
    q: "你现在用 AI 做什么？",
    options: [
      { label: "基本没用过，或者只是随便问问", level: 0 },
      { label: "让它帮我改改句子、解释术语", level: 1 },
      { label: "已经在用它翻文本、查资料", level: 2 },
      { label: "已经在搭流程，想让它自动跑", level: 3 },
    ],
  },
  {
    q: "你手上最痛的是哪一步？",
    options: [
      { label: "还没开始，不知道从哪下手", level: 0 },
      { label: "翻出来的东西术语不统一", level: 1 },
      { label: "一批文本要翻好几种语言", level: 2 },
      { label: "每次版本更新都要重新对一遍全量表", level: 3 },
    ],
  },
  {
    q: "你希望交付什么？",
    options: [
      { label: "先能自己独立完成一件小事", level: 0 },
      { label: "一份术语一致、能直接用的译文", level: 1 },
      { label: "一张多语言对照表", level: 2 },
      { label: "一条能反复跑的增量流水线", level: 3 },
    ],
  },
];

const RESULTS: Record<
  number,
  { title: string; desc: string; href: string; cta: string; extra?: { href: string; label: string } }
> = {
  0: {
    title: "从「先把 AI 用起来」开始",
    desc: "你不需要先学原理。第 1 课就让你用 AI 完成一件真实的小事，15 分钟出结果。",
    href: "/learn/start-here",
    cta: "进第 1 课",
    extra: { href: "/learn", label: "看完整路径" },
  },
  1: {
    title: "从「翻译与术语」开始",
    desc: "先解决术语漂移：生成术语表 → 带上下文翻译 → 机翻校订自检。这几节是本地化的地基。",
    href: "/learn/l10n-basics",
    cta: "从本地化基础开始",
    extra: { href: "/library?type=prompt", label: "先拿个术语表模板" },
  },
  2: {
    title: "从「多语言批量」开始",
    desc: "你已经会翻单一语言了。接下来用对照表 + 分批脚本一次产出多种语言，再统一质检。",
    href: "/learn/mlt-parallel",
    cta: "进多语言批量",
    extra: { href: "/learn/mlt-batch", label: "直接看批量脚本" },
  },
  3: {
    title: "从「增量流水线」开始",
    desc: "你该关心的是：怎么只翻新增和变更、怎么独立 QA、怎么锁定回写。这里有完整可跑的方案。",
    href: "/learn/inc-full-vs-delta",
    cta: "进增量流水线",
    extra: { href: "/downloads/incremental-l10n.zip", label: "下载现成工具包" },
  },
};

export function LevelQuiz() {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const pick = (level: number) => {
    const next = [...scores, level];
    setScores(next);
    if (step + 1 >= QUESTIONS.length) setDone(true);
    else setStep(step + 1);
  };

  const reset = () => {
    setStep(0);
    setScores([]);
    setDone(false);
  };

  if (done) {
    const level = Math.max(...scores);
    const result = RESULTS[level];
    return (
      <div className="quiz-box">
        <div className="quiz-result-title">{result.title}</div>
        <p className="quiz-result-desc">{result.desc}</p>
        <div className="quiz-actions">
          <Link href={result.href} className="btn btn-primary btn-sm">
            {result.cta} →
          </Link>
          {result.extra && (
            <Link href={result.extra.href} className="btn btn-line btn-sm">
              {result.extra.label}
            </Link>
          )}
          <button type="button" className="quiz-reset" onClick={reset}>
            重新测
          </button>
        </div>
      </div>
    );
  }

  const current = QUESTIONS[step];
  return (
    <div className="quiz-box">
      <div className="quiz-progress">
        问题 {step + 1} / {QUESTIONS.length}
      </div>
      <div className="quiz-question">{current.q}</div>
      <div className="quiz-options">
        {current.options.map((opt) => (
          <button key={opt.label} type="button" className="quiz-option" onClick={() => pick(opt.level)}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
