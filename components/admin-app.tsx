"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Category, CrawlConfig, CrawlReport, Source } from "@/lib/types";
import { CopyButton } from "./copy-button";

type SafeConfig = CrawlConfig & { llmKeySet?: boolean };

interface Status {
  storage: string;
  storageBackend?: string;
  storageLabel?: string;
  items: number;
  adminConfigured: boolean;
  cronConfigured: boolean;
  llmEnabled: boolean;
  llmKeySet: boolean;
  siteUrl: string;
  platform?: string;
}

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "news", label: "行业动态" },
  { value: "skill", label: "使用技巧" },
  { value: "tool", label: "工具上新" },
  { value: "research", label: "前沿研究" },
];

const PW_KEY = "aiqihang:admin-pw";

export function AdminApp() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [config, setConfig] = useState<SafeConfig | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const [report, setReport] = useState<CrawlReport | null>(null);
  const pwRef = useRef("");

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": pwRef.current,
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok === false) {
      throw new Error(typeof data.error === "string" ? data.error : `请求失败 (${res.status})`);
    }
    return data;
  }, []);

  const login = useCallback(
    async (candidate: string) => {
      pwRef.current = candidate;
      setBusy("login");
      setMessage(null);
      try {
        const data = (await request("/api/admin/config")) as {
          config: SafeConfig;
          status: Status;
        };
        setConfig({ ...data.config, keywords: data.config.keywords || [] });
        setKeywords((data.config.keywords || []).join("\n"));
        setStatus(data.status);
        setAuthed(true);
        try {
          sessionStorage.setItem(PW_KEY, candidate);
        } catch {
          /* ignore */
        }
      } catch (err) {
        pwRef.current = "";
        setAuthed(false);
        setMessage({ type: "err", text: err instanceof Error ? err.message : "登录失败" });
      } finally {
        setBusy(null);
      }
    },
    [request]
  );

  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(PW_KEY) || "";
    } catch {
      saved = "";
    }
    if (saved) {
      setPassword(saved);
      void login(saved);
    }
  }, [login]);

  const patchConfig = (patch: Partial<SafeConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const patchSource = (index: number, patch: Partial<Source>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const sources = prev.sources.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...prev, sources };
    });
  };

  const addSource = () => {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            sources: [
              ...prev.sources,
              {
                id: `custom-${Date.now()}`,
                name: "新数据源",
                url: "https://",
                category: "news",
                enabled: true,
                aiOnly: false,
              },
            ],
          }
        : prev
    );
  };

  const removeSource = (index: number) => {
    setConfig((prev) =>
      prev ? { ...prev, sources: prev.sources.filter((_, i) => i !== index) } : prev
    );
  };

  async function save() {
    if (!config) return;
    setBusy("save");
    setMessage(null);
    try {
      const payload = {
        sources: config.sources,
        keywords: keywords
          .split(/[\n,，]/)
          .map((k) => k.trim())
          .filter(Boolean),
        maxPerSource: config.maxPerSource,
        maxAgeDays: config.maxAgeDays,
        maxItemsPerRun: config.maxItemsPerRun,
        retention: config.retention,
        llm: config.llm,
      };
      const data = (await request("/api/admin/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      })) as { config: SafeConfig; status: Status; persisted?: string };
      setConfig({ ...data.config });
      setKeywords((data.config.keywords || []).join("\n"));
      setStatus(data.status);
      setMessage({ type: "ok", text: "配置已保存（下一个定时任务生效）" });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setBusy(null);
    }
  }

  async function testLLM() {
    if (!config) return;
    setBusy("llm");
    setMessage(null);
    try {
      const data = (await request("/api/admin/test-llm", {
        method: "POST",
        body: JSON.stringify({
          baseUrl: config.llm.baseUrl,
          apiKey: config.llm.apiKey,
          model: config.llm.model,
        }),
      })) as { latencyMs: number; model: string; sample: string };
      setMessage({
        type: "ok",
        text: `连接成功 · ${data.model} · ${data.latencyMs}ms · 模型回复「${data.sample}」`,
      });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "测试失败" });
    } finally {
      setBusy(null);
    }
  }

  async function runCrawl() {
    setBusy("crawl");
    setMessage(null);
    try {
      const data = (await request("/api/crawl", { method: "POST", body: "{}" })) as {
        report: CrawlReport;
      };
      setReport(data.report);
      setMessage({
        type: data.report.added > 0 ? "ok" : "info",
        text: `抓取完成：新增 ${data.report.added} 条，库内共 ${data.report.total} 条，用时 ${Math.round(
          data.report.durationMs / 1000
        )} 秒${data.report.errors.length ? `，${data.report.errors.length} 个源报错` : ""}`,
      });
      const refreshed = (await request("/api/admin/config")) as {
        config: SafeConfig;
        status: Status;
      };
      setStatus(refreshed.status);
      setConfig((prev) => (prev ? { ...prev, lastRun: refreshed.config.lastRun } : refreshed.config));
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "抓取失败" });
    } finally {
      setBusy(null);
    }
  }

  async function clearItems() {
    if (!window.confirm("确定清空所有自动抓取的条目吗？课程和冷启动内容不受影响。")) return;
    setBusy("clear");
    try {
      await request("/api/admin/items", { method: "DELETE" });
      setMessage({ type: "ok", text: "已清空抓取条目" });
      const refreshed = (await request("/api/admin/config")) as {
        config: SafeConfig;
        status: Status;
      };
      setStatus(refreshed.status);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "清空失败" });
    } finally {
      setBusy(null);
    }
  }

  function logout() {
    pwRef.current = "";
    setAuthed(false);
    setConfig(null);
    setPassword("");
    try {
      sessionStorage.removeItem(PW_KEY);
    } catch {
      /* ignore */
    }
  }

  if (!authed) {
    return (
      <div className="container admin-wrap" style={{ maxWidth: 460 }}>
        <div className="panel">
          <div className="eyebrow">管理台</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>输入管理密码</h1>
          <p className="panel-desc">
            密码来自 Vercel 环境变量 <code>ADMIN_PASSWORD</code>。登录后可以配置数据源、大模型 API
            和手动触发抓取。
          </p>
          {message?.type === "err" && <div className="alert alert-err">{message.text}</div>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (password.trim()) void login(password.trim());
            }}
          >
            <div className="field">
              <label htmlFor="admin-pw">管理密码</label>
              <input
                id="admin-pw"
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="ADMIN_PASSWORD"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy === "login"}>
              {busy === "login" ? "验证中…" : "进入管理台"}
            </button>
          </form>
        </div>
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          还没部署？先看项目里的 <code>README.md</code>，或者回{" "}
          <Link href="/">首页</Link> 逛逛。
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container admin-wrap">
        <div className="panel">加载中…</div>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : status?.siteUrl || "";

  return (
    <div className="container admin-wrap">
      <div className="section-head" style={{ alignItems: "center" }}>
        <div>
          <div className="eyebrow">管理台</div>
          <h1 className="section-title" style={{ fontSize: 28 }}>
            爬虫与内容配置
          </h1>
          <p className="section-desc">
            改完记得点保存。抓取任务每天北京时间 08:30 自动跑一次（vercel.json 里可改）。
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-line btn-sm" onClick={logout}>
            退出
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy === "save"}>
            {busy === "save" ? "保存中…" : "保存配置"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type === "ok" ? "ok" : message.type === "err" ? "err" : "info"}`}>
          {message.text}
        </div>
      )}

      {status?.storage === "memory" && (
        <div className="alert alert-warn">
          当前没有配置持久化存储，抓到的内容不会保存下来，刷新就没了。二选一：
          <br />
          · Vercel / Upstash：配置 <code>KV_REST_API_URL</code> + <code>KV_REST_API_TOKEN</code>
          <br />
          · 腾讯云 / 自建：配置 <code>REDIS_URL</code>（形如 <code>redis://:密码@IP:6379/0</code>）
        </div>
      )}
      {status && !status.adminConfigured && (
        <div className="alert alert-err">
          服务端没有 <code>ADMIN_PASSWORD</code>。现在能进这个页面只是本地开发环境放行，部署后必须配置。
        </div>
      )}
      {status && !status.cronConfigured && (
        <div className="alert alert-warn">
          没有 <code>CRON_SECRET</code>：生产环境定时接口会拒绝执行。请补上这个环境变量。
        </div>
      )}

      <div className="admin-grid">
        <div>
          <div className="panel">
            <div className="panel-title">数据源（{config.sources.filter((s) => s.enabled).length} 个启用）</div>
            <p className="panel-desc">
              必须是 RSS / Atom 地址。标了「只收 AI 相关」的泛科技源，会用关键词过滤掉无关条目。
            </p>
            {config.sources.map((source, index) => (
              <div key={`${source.id}-${index}`} className={`source-row${source.enabled ? "" : " disabled"}`}>
                <input
                  className="check"
                  type="checkbox"
                  checked={source.enabled}
                  onChange={(event) => patchSource(index, { enabled: event.target.checked })}
                  title="是否启用"
                  aria-label={`启用 ${source.name}`}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    className="input"
                    style={{ marginBottom: 6, fontSize: 13 }}
                    value={source.name}
                    onChange={(event) => patchSource(index, { name: event.target.value })}
                    aria-label="源名称"
                  />
                  <input
                    className="input"
                    style={{ fontSize: 12 }}
                    value={source.url}
                    onChange={(event) => patchSource(index, { url: event.target.value })}
                    aria-label="RSS 地址"
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      className="select"
                      style={{ width: 130, padding: "5px 8px", fontSize: 12.5 }}
                      value={source.category}
                      onChange={(event) =>
                        patchSource(index, { category: event.target.value as Category })
                      }
                      aria-label="分类"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        className="check"
                        type="checkbox"
                        checked={Boolean(source.aiOnly)}
                        onChange={(event) => patchSource(index, { aiOnly: event.target.checked })}
                      />
                      只收 AI 相关
                    </label>
                    <label style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        className="check"
                        type="checkbox"
                        checked={Boolean(source.l10nOnly)}
                        onChange={(event) => patchSource(index, { l10nOnly: event.target.checked })}
                      />
                      只收本地化相关
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => removeSource(index)}
                  title="删除这个源"
                >
                  删除
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-line btn-sm" onClick={addSource}>
              + 添加数据源
            </button>
          </div>

          <div className="panel">
            <div className="panel-title">抓取参数</div>
            <p className="panel-desc">控制每次抓多少、留多久。参数越大越慢，Vercel 单次函数最长 60 秒。</p>
            <div className="row-2">
              <div className="field">
                <label htmlFor="maxPerSource">每个源最多取几条</label>
                <input
                  id="maxPerSource"
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  value={config.maxPerSource}
                  onChange={(event) => patchConfig({ maxPerSource: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="maxItemsPerRun">单次最多入库</label>
                <input
                  id="maxItemsPerRun"
                  className="input"
                  type="number"
                  min={4}
                  max={60}
                  value={config.maxItemsPerRun}
                  onChange={(event) => patchConfig({ maxItemsPerRun: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="maxAgeDays">只收最近多少天</label>
                <input
                  id="maxAgeDays"
                  className="input"
                  type="number"
                  min={1}
                  max={90}
                  value={config.maxAgeDays}
                  onChange={(event) => patchConfig({ maxAgeDays: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="retention">知识库最多保留</label>
                <input
                  id="retention"
                  className="input"
                  type="number"
                  min={50}
                  max={2000}
                  value={config.retention}
                  onChange={(event) => patchConfig({ retention: Number(event.target.value) })}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="keywords">关键词过滤（可选）</label>
              <textarea
                id="keywords"
                className="textarea"
                rows={3}
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="留空表示不过滤。一行一个，或用逗号分隔，例如：Agent / 提示词 / 开源"
              />
              <span className="hint">填了之后，只保留标题或摘要里命中这些词的条目。</span>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">大模型 API（用来写中文摘要）</div>
            <p className="panel-desc">
              任何 OpenAI 兼容接口都行：DeepSeek、OpenAI、Moonshot、通义、本地 Ollama 网关等。
              不填也能跑，只是摘要会直接用原文。
            </p>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, fontSize: 14 }}>
              <input
                className="check"
                type="checkbox"
                checked={config.llm.enabled}
                onChange={(event) =>
                  patchConfig({ llm: { ...config.llm, enabled: event.target.checked } })
                }
              />
              启用大模型摘要
            </label>
            <div className="field">
              <label htmlFor="llm-base">Base URL</label>
              <input
                id="llm-base"
                className="input"
                value={config.llm.baseUrl}
                onChange={(event) =>
                  patchConfig({ llm: { ...config.llm, baseUrl: event.target.value } })
                }
                placeholder="https://api.deepseek.com/v1"
              />
              <span className="hint">带不带 /v1 都可以，程序会自动尝试。</span>
            </div>
            <div className="row-2">
              <div className="field">
                <label htmlFor="llm-model">模型名</label>
                <input
                  id="llm-model"
                  className="input"
                  value={config.llm.model}
                  onChange={(event) =>
                    patchConfig({ llm: { ...config.llm, model: event.target.value } })
                  }
                  placeholder="deepseek-chat"
                />
              </div>
              <div className="field">
                <label htmlFor="llm-temp">温度</label>
                <input
                  id="llm-temp"
                  className="input"
                  type="number"
                  step="0.1"
                  min={0}
                  max={2}
                  value={config.llm.temperature}
                  onChange={(event) =>
                    patchConfig({ llm: { ...config.llm, temperature: Number(event.target.value) } })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="llm-key">API Key</label>
              <input
                id="llm-key"
                className="input"
                type="password"
                value={config.llm.apiKey}
                onChange={(event) =>
                  patchConfig({ llm: { ...config.llm, apiKey: event.target.value } })
                }
                placeholder={status?.llmKeySet ? "已保存（留空表示不修改）" : "sk-..."}
                autoComplete="off"
              />
              <span className="hint">
                Key 只存在服务端 Redis 里，页面读不到明文。也可以用环境变量 LLM_API_KEY。
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-line btn-sm" onClick={testLLM} disabled={busy === "llm"}>
                {busy === "llm" ? "测试中…" : "测试连接"}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy === "save"}>
                保存
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-title">运行状态</div>
            <div className="kv">
              <span>存储方式</span>
              <span style={{ color: status?.storage === "redis" ? "#047857" : "#b45309" }}>
                {status?.storage === "redis" ? `${status?.storageLabel || "Redis"}（已持久化）` : "内存（不持久化）"}
              </span>
            </div>
            <div className="kv">
              <span>知识库条数</span>
              <span>{status?.items ?? "—"}</span>
            </div>
            <div className="kv">
              <span>大模型</span>
              <span>{status?.llmEnabled ? "已启用" : "未启用（用原文兜底）"}</span>
            </div>
            <div className="kv">
              <span>管理密码</span>
              <span style={{ color: status?.adminConfigured ? "#047857" : "#be123c" }}>
                {status?.adminConfigured ? "已配置" : "未配置"}
              </span>
            </div>
            <div className="kv">
              <span>定时密钥</span>
              <span style={{ color: status?.cronConfigured ? "#047857" : "#b45309" }}>
                {status?.cronConfigured ? "已配置" : "未配置"}
              </span>
            </div>
            {config.lastRun && (
              <>
                <div className="kv">
                  <span>上次抓取</span>
                  <span>{new Date(config.lastRun.finishedAt).toLocaleString("zh-CN")}</span>
                </div>
                <div className="kv">
                  <span>上次结果</span>
                  <span>
                    新增 {config.lastRun.added} / 共 {config.lastRun.total} 条 · {Math.round(config.lastRun.durationMs / 1000)}s
                  </span>
                </div>
              </>
            )}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={runCrawl} disabled={busy === "crawl"}>
                {busy === "crawl" ? "抓取中（最多 60 秒）…" : "立即抓取一次"}
              </button>
              <button type="button" className="btn btn-line btn-sm" onClick={clearItems} disabled={busy === "clear"}>
                清空抓取条目
              </button>
            </div>
          </div>

          {report && (
            <div className="panel">
              <div className="panel-title">本次抓取报告</div>
              <pre className="log-box">{JSON.stringify(report, null, 2)}</pre>
            </div>
          )}

          <div className="panel">
            <div className="panel-title">定时任务怎么调</div>
            <p className="panel-desc">
              Vercel Cron 会按 <code>vercel.json</code> 的配置自动请求，并带上密钥。想立刻跑一次，用命令行：
            </p>
            <pre className="log-box">{`curl -X GET "${origin}/api/cron/crawl?secret=YOUR_CRON_SECRET"`}</pre>
            <div className="copy-row">
              <CopyButton text={`curl -X GET "${origin}/api/cron/crawl?secret=YOUR_CRON_SECRET"`} label="复制命令" />
            </div>
            <p className="panel-desc" style={{ marginTop: 14 }}>
              注意：Hobby 套餐的 Cron 每天只能跑一次；想更频繁，用 GitHub Actions 定时 curl 这个地址即可。
            </p>
          </div>

          <div className="panel">
            <div className="panel-title">内容原则</div>
            <ul className="kb-points">
              <li>只抓公开 RSS，不改写事实，保留原文链接</li>
              <li>摘要由模型生成，页面上明确标注「可能有偏差」</li>
              <li>不存全文，只存摘要与要点</li>
              <li>内容版权归原作者，本站只做导航</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
