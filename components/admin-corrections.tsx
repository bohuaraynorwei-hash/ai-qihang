"use client";

import { useCallback, useEffect, useState } from "react";
import type { Correction, ProofreadReport } from "@/lib/types";

interface Props {
  password: string;
}

interface Counts {
  applied: number;
  pending: number;
  rejected: number;
  human: number;
}

const KIND_LABEL: Record<string, string> = {
  typo: "错别字",
  punctuation: "标点",
  grammar: "语病",
  term: "术语",
  fact: "事实",
  style: "风格",
};

export function AdminCorrections({ password }: Props) {
  const [items, setItems] = useState<Correction[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<"pending" | "applied" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<ProofreadReport | null>(null);

  const req = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
          ...(init.headers || {}),
        },
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.ok === false) {
        throw new Error(typeof data.error === "string" ? data.error : `请求失败 (${res.status})`);
      }
      return data;
    },
    [password]
  );

  const load = useCallback(
    async (status: string) => {
      setBusy("load");
      try {
        const data = (await req(`/api/admin/corrections?status=${status}&limit=80`)) as {
          items: Correction[];
          counts: Counts;
          total: number;
        };
        setItems(data.items || []);
        setCounts(data.counts || null);
        setTotal(data.total || 0);
      } catch (err) {
        setMsg({ ok: false, text: err instanceof Error ? err.message : "加载失败" });
      } finally {
        setBusy(null);
      }
    },
    [req]
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function review(id: string, action: "apply" | "reject") {
    setBusy(id);
    setMsg(null);
    try {
      const data = (await req("/api/admin/corrections", {
        method: "POST",
        body: JSON.stringify({ id, action }),
      })) as { message?: string };
      setMsg({ ok: true, text: data.message || "已处理" });
      await load(tab);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "处理失败" });
    } finally {
      setBusy(null);
    }
  }

  async function runProofread(force: boolean) {
    setBusy("run");
    setMsg(null);
    try {
      const data = (await req("/api/cron/proofread", {
        method: "POST",
        body: JSON.stringify({ limit: 12, force }),
      })) as { report: ProofreadReport };
      setReport(data.report);
      setMsg({
        ok: true,
        text: `校对完成：检查 ${data.report.checked} 条，自动修正 ${data.report.applied} 处，待确认 ${data.report.pending} 处`,
      });
      await load(tab);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "校对失败" });
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("从记录里删掉这一条？（已修正的内容不会还原）")) return;
    setBusy(id);
    setMsg(null);
    try {
      const data = (await req(`/api/admin/corrections?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })) as { message?: string };
      setMsg({ ok: true, text: data.message || "已删除" });
      await load(tab);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "删除失败" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">自动纠错</div>
      <p className="panel-desc">
        用大模型校对已入库的标题/摘要/要点，只改错别字、标点和明显语病；改动幅度过大会自动降级为「待确认」。
        读者提交的纠错也在这里审核。
      </p>

      {counts && (
        <div className="kv">
          <span>记录总数</span>
          <span>
            共 {total} 条 · 已应用 {counts.applied} · 待确认 {counts.pending} · 已忽略 {counts.rejected} ·
            读者提交 {counts.human}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => runProofread(false)}
          disabled={busy === "run"}
        >
          {busy === "run" ? "校对中（约 20-40 秒）…" : "立即校对未校对的"}
        </button>
        <button
          type="button"
          className="btn btn-line btn-sm"
          onClick={() => runProofread(true)}
          disabled={busy === "run"}
          title="连已校对过的条目也重新校对一遍"
        >
          强制重校
        </button>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {(["pending", "applied", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`chip${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
            style={{ border: 0 }}
          >
            {t === "pending" ? "待确认" : t === "applied" ? "已应用" : "全部"}
          </button>
        ))}
      </div>

      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>}

      {items.length === 0 && busy !== "load" && (
        <div className="empty" style={{ padding: "24px 12px", fontSize: 13 }}>
          {tab === "pending" ? "没有待确认的纠错，很干净。" : "暂无记录。"}
        </div>
      )}

      {items.map((c) => (
        <div key={c.id} className="corr-item">
          <div className="corr-top">
            <span className={`corr-badge ${c.status}`}>
              {c.status === "applied" ? "已应用" : c.status === "pending" ? "待确认" : "已忽略"}
            </span>
            <span className="corr-badge" style={{ background: "#eef2ff", color: "#4338ca" }}>
              {c.source === "human" ? "读者提交" : "自动"}
            </span>
            <span className="corr-badge" style={{ background: "#f4f4f5", color: "#52525b" }}>
              {KIND_LABEL[c.kind] || c.kind}
            </span>
            <span style={{ color: "var(--muted-2)", fontSize: 11.5 }}>
              {c.field === "point" ? `要点 #${(c.index ?? 0) + 1}` : c.field === "title" ? "标题" : "摘要"}
            </span>
          </div>

          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5 }}>{c.itemTitle}</div>
          <div className="corr-diff">
            <span className="corr-before">− {c.before}</span>
            <span className="corr-after">+ {c.after}</span>
          </div>
          <div className="corr-meta">
            <span>{c.reason}</span>
            {c.blockedBy && <span style={{ color: "#b45309" }}>未自动应用：{c.blockedBy}</span>}
            <span>{new Date(c.createdAt).toLocaleString("zh-CN")}</span>
          </div>

          {c.status === "pending" ? (
            <div className="corr-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => review(c.id, "apply")}
                disabled={busy === c.id}
              >
                应用
              </button>
              <button
                type="button"
                className="btn btn-line btn-sm"
                onClick={() => review(c.id, "reject")}
                disabled={busy === c.id}
              >
                忽略
              </button>
            </div>
          ) : (
            <div className="corr-actions">
              <button
                type="button"
                className="copy-btn"
                style={{ fontSize: 11.5, padding: "4px 10px" }}
                onClick={() => remove(c.id)}
                disabled={busy === c.id}
                title="从记录里删掉这一条（不影响已修正的内容）"
              >
                删除记录
              </button>
            </div>
          )}
        </div>
      ))}

      {report && report.details.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 700 }}>
            查看本次校对明细（{report.details.length} 处）
          </summary>
          <pre className="log-box" style={{ marginTop: 10, maxHeight: 220 }}>
            {report.details
              .map(
                (d) =>
                  `[${d.status}] ${d.kind} · ${d.field}\n  − ${d.before}\n  + ${d.after}${
                    d.reason ? `\n  说明：${d.reason}` : ""
                  }`
              )
              .join("\n\n")}
          </pre>
        </details>
      )}
    </div>
  );
}
