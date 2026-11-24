#!/usr/bin/env node
/**
 * 触发一次抓取（给 crontab / 宝塔计划任务 / systemd timer 用）。
 *
 * 用法：
 *   SITE_URL=https://your-domain.com CRON_SECRET=xxx node scripts/trigger-crawl.mjs
 *   # 本机直连（不经 Nginx）也可以：
 *   SITE_URL=http://127.0.0.1:3000 CRON_SECRET=xxx node scripts/trigger-crawl.mjs
 *
 * 退出码：0 成功；1 失败（便于 cron 记录日志 / 报警）。
 */

const siteUrl = (process.env.SITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET || "";

if (!secret) {
  console.error("[crawl] 缺少 CRON_SECRET 环境变量");
  process.exit(1);
}

const url = `${siteUrl}/api/cron/crawl?secret=${encodeURIComponent(secret)}`;
console.log(`[crawl] ${new Date().toISOString()} 触发 ${siteUrl}/api/cron/crawl`);

try {
  const res = await fetch(url, {
    method: "GET",
    headers: { "user-agent": "aiqihang-cron/1.0" },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[crawl] 失败 HTTP ${res.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* 忽略 */
  }
  const report = data.report || {};
  console.log(
    `[crawl] 成功：新增 ${report.added ?? "?"} 条，库内 ${report.total ?? "?"} 条，用时 ${Math.round(
      (report.durationMs ?? 0) / 1000
    )} 秒，大模型 ${report.llm ? "已启用" : "未启用"}`
  );
  if (Array.isArray(report.errors) && report.errors.length) {
    console.warn(`[crawl] 部分源报错（不影响整体）：${report.errors.join("; ")}`);
  }
} catch (err) {
  console.error(`[crawl] 请求异常：${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
