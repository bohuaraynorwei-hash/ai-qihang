#!/usr/bin/env node
/**
 * 部署前自检：验证 REDIS_URL / Upstash 是否真的能连上、能读写。
 *
 * 用法：
 *   REDIS_URL=redis://:密码@10.0.0.1:6379/0 node scripts/check-redis.mjs
 *
 * 腾讯云 Redis 默认不允许外网直连，请在同一个 VPC 的 CVM 上跑这个脚本。
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const restUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const restToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const redisUrl = process.env.REDIS_URL || process.env.KV_URL || "";

const TEST_KEY = "aiqihang:selftest";
const TEST_VAL = JSON.stringify({ at: new Date().toISOString(), ok: true });

function mask(u) {
  try {
    const parsed = new URL(u);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return u;
  }
}

async function checkUpstash() {
  console.log(`[自检] Upstash REST -> ${mask(restUrl)}`);
  const res = await fetch(restUrl.replace(/\/+$/, ""), {
    method: "POST",
    headers: { Authorization: `Bearer ${restToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(["PING"]),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  console.log(`[自检] PING 返回 ${JSON.stringify(json.result)}`);
  await fetch(restUrl.replace(/\/+$/, ""), {
    method: "POST",
    headers: { Authorization: `Bearer ${restToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(["SET", TEST_KEY, TEST_VAL]),
  });
  const getRes = await fetch(restUrl.replace(/\/+$/, ""), {
    method: "POST",
    headers: { Authorization: `Bearer ${restToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(["GET", TEST_KEY]),
  });
  const got = await getRes.json();
  if (got.result !== TEST_VAL) throw new Error("写入后读回的值不一致");
  console.log("[自检] 读写正常 ✅");
}

async function checkRedis() {
  console.log(`[自检] 标准 Redis -> ${mask(redisUrl)}`);
  const { default: Redis } = require("ioredis");
  const client = new Redis(redisUrl, {
    connectTimeout: 8000,
    maxRetriesPerRequest: 1,
    retryStrategy: (t) => (t > 2 ? null : 500),
  });
  client.on("error", (e) => console.error("[自检] 连接错误:", e.message));
  try {
    const pong = await client.ping();
    console.log(`[自检] PING 返回 ${pong}`);
    await client.set(TEST_KEY, TEST_VAL);
    const got = await client.get(TEST_KEY);
    if (got !== TEST_VAL) throw new Error("写入后读回的值不一致");
    console.log("[自检] 读写正常 ✅");
    await client.del(TEST_KEY);
  } finally {
    client.disconnect();
  }
}

try {
  if (redisUrl && /^rediss?:\/\//i.test(redisUrl)) {
    await checkRedis();
  } else if (restUrl && restToken) {
    await checkUpstash();
  } else {
    console.error("[自检] 既没有 REDIS_URL 也没有 KV_REST_API_URL/TOKEN，存储会退化为内存模式。");
    process.exit(1);
  }
} catch (err) {
  console.error(`[自检] 失败：${err instanceof Error ? err.message : err}`);
  console.error(
    "[自检] 常见原因：安全组没放通端口 / 腾讯云 Redis 未开启内网访问 / 密码错 / 不在同一 VPC。"
  );
  process.exit(1);
}
