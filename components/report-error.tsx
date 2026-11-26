"use client";

import { useState } from "react";

interface Props {
  itemId: string;
  /** 用于「一键填入」的可选字段值 */
  title: string;
  summary: string;
  points: string[];
}

export function ReportError({ itemId, title, summary, points }: Props) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<"title" | "summary" | "point">("summary");
  const [index, setIndex] = useState(0);
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const currentText = field === "title" ? title : field === "summary" ? summary : points[index] ?? "";

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          field,
          index: field === "point" ? index : undefined,
          before: before.trim(),
          after: after.trim(),
          reason: reason.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || data.ok === false) {
        setMsg({ ok: false, text: data.error || "提交失败" });
      } else {
        setMsg({ ok: true, text: data.message || "已收到，谢谢！" });
        setBefore("");
        setAfter("");
        setReason("");
        setTimeout(() => setOpen(false), 2600);
      }
    } catch {
      setMsg({ ok: false, text: "网络异常，请稍后再试" });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="report-trigger" onClick={() => setOpen(true)}>
        发现错别字或错误？点这里告诉我们
      </button>
    );
  }

  return (
    <div className="report-box">
      <div className="report-head">
        <strong>报告错误</strong>
        <span>会自动进入审核队列，确认后修正</span>
        <button type="button" className="report-close" onClick={() => setOpen(false)} aria-label="关闭">
          ✕
        </button>
      </div>

      <div className="report-row">
        <label>错误在哪一块</label>
        <select
          className="select"
          value={field}
          onChange={(e) => setField(e.target.value as "title" | "summary" | "point")}
        >
          <option value="title">标题</option>
          <option value="summary">摘要</option>
          <option value="point">要点</option>
        </select>
        {field === "point" && points.length > 1 && (
          <select className="select" value={index} onChange={(e) => setIndex(Number(e.target.value))}>
            {points.map((p, i) => (
              <option key={i} value={i}>
                第 {i + 1} 条：{p.slice(0, 14)}…
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="report-row">
        <label>原文里错的那一段（可留空）</label>
        <input
          className="input"
          value={before}
          onChange={(e) => setBefore(e.target.value)}
          placeholder="例如：都是需要留意的事节"
        />
      </div>

      <div className="report-row">
        <label>应该是什么</label>
        <input
          className="input"
          value={after}
          onChange={(e) => setAfter(e.target.value)}
          placeholder="例如：都是需要留意的事项"
        />
      </div>

      <div className="report-row">
        <label>补充说明（可选）</label>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例如：错别字"
        />
      </div>

      <div className="report-current">
        当前内容：<span>{currentText.slice(0, 120)}{currentText.length > 120 ? "…" : ""}</span>
      </div>

      {msg && (
        <div className={`report-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>
      )}

      <div className="report-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={submit}
          disabled={busy || !after.trim()}
        >
          {busy ? "提交中…" : "提交"}
        </button>
        <button type="button" className="btn btn-line btn-sm" onClick={() => setOpen(false)}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-line btn-sm"
          onClick={() => {
            const pick = currentText.slice(0, 40);
            setBefore(pick);
            setAfter(pick);
          }}
          title="填入当前内容开头，方便你直接改"
        >
          填入当前开头
        </button>
      </div>
    </div>
  );
}
