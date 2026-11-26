#!/usr/bin/env node
/**
 * 导航一致性冒烟测试（跑在已部署的站点上）
 *
 * 背景：课程按「阶段」分组渲染，但 LESSONS 数组里的顺序和阶段顺序不同。
 * 曾经 neighbors() 用数组下标算前后课，导致 3 个阶段衔接点跳错。
 * 这个脚本逐课打开线上页面，检查「下一课/下一阶段」按钮指向是否等于学习路径的下一课。
 *
 * 用法：
 *   SITE_URL=https://your-site.com node scripts/test-nav.mjs
 *   node scripts/test-nav.mjs https://your-site.com
 *
 * 退出码 0 = 全部正确；1 = 有错位（可用于 CI）。
 */

const BASE = (
  process.argv[2] ||
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://ai-qihang.vercel.app"
).replace(/\/+$/, "");

/**
 * 学习路径顺序（与 lib/curriculum.ts 的 ORDERED_LESSONS 应一致）。
 * 这里硬编码一份，是为了能独立于代码校验线上真实行为——
 * 如果代码改了顺序却忘了更新这里，测试会失败，逼迫两边对齐。
 */
const EXPECT = [
  // 01 · AI 基本功
  "start-here", "prompt-basics", "prompt-advanced", "context-memory", "agent-basics",
  "tools-and-permissions", "skill-basics", "workflows", "safety", "30-day-plan",
  // 02 · 翻译与术语
  "l10n-basics", "l10n-extract", "l10n-translate", "l10n-mtpe", "l10n-dsh-skill", "l10n-codex",
  // 03 · 多语言批量
  "mlt-parallel", "mlt-batch", "mlt-qa", "mlt-delivery",
  // 04 · 增量流水线
  "inc-full-vs-delta", "inc-style-guide", "inc-glossary-checklist", "inc-generate", "inc-qa", "inc-lock",
  // 05 · 自动化进阶
  "adv-system-prompt", "adv-structured-output", "adv-agent-ops", "adv-skill-ops", "eco-hook-skill-mcp-plugin",
];

/** 从页面 HTML 里找「下一课 / 下一阶段」按钮指向的 slug */
function findNext(html) {
  // 正文里也可能出现这两个词，按钮在正文之后，取最后一次
  const stageIdx = html.lastIndexOf("下一阶段");
  const nextIdx = html.lastIndexOf("下一课");
  const isStage = stageIdx >= 0 && stageIdx > nextIdx;
  const i = isStage ? stageIdx : nextIdx;
  if (i === -1) return { kind: null, slug: null };
  const back = html.slice(Math.max(0, i - 1500), i);
  // 兼容 href="/learn/x" 与 RSC 转义 \"href\":\"/learn/x\"
  const all = [...back.matchAll(/href[^a-z0-9]{0,10}\/learn\/([a-z0-9-]+)/g)];
  return { kind: isStage ? "下一阶段" : "下一课", slug: all.length ? all[all.length - 1][1] : null };
}

console.log(`检查 ${BASE} 上 ${EXPECT.length} 节课的导航顺序…\n`);

let fail = 0;
const boundaries = [];

for (let i = 0; i < EXPECT.length; i++) {
  const slug = EXPECT[i];
  let html = "";
  try {
    const res = await fetch(`${BASE}/learn/${slug}`);
    if (!res.ok) {
      console.log(`  FAIL ${String(i + 1).padStart(2)}. ${slug}  HTTP ${res.status}`);
      fail++;
      continue;
    }
    html = await res.text();
  } catch (err) {
    console.log(`  FAIL ${String(i + 1).padStart(2)}. ${slug}  ${err.message}`);
    fail++;
    continue;
  }

  const { kind, slug: actual } = findNext(html);
  const expect = EXPECT[i + 1] ?? null;
  const ok = actual === expect;
  if (!ok) fail++;
  if (kind === "下一阶段") boundaries.push(`${slug} → ${actual}`);

  console.log(
    `  ${ok ? "OK  " : "FAIL"} ${String(i + 1).padStart(2)}. ${slug.padEnd(26)} [${kind ?? "末课"}] → ${
      actual ?? "null"
    }${ok ? "" : `  (应为 ${expect ?? "null"})`}`
  );
}

console.log(`\n阶段衔接点（应有 ${EXPECT.length ? "4" : "0"} 个）：`);
boundaries.forEach((b) => console.log("  · " + b));

if (fail === 0) {
  console.log("\n导航顺序全部正确 ✅");
  process.exit(0);
}
console.log(`\n${fail} 处导航错位 ❌`);
process.exit(1);
