"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "aiqihang:done";
const EVENT = "aiqihang:done-change";

function readDone(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeDone(list: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 隐私模式下写不进去就算了 */
  }
  window.dispatchEvent(new Event(EVENT));
}

function useDone() {
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setDone(readDone());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    const current = readDone();
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    writeDone(next);
  }, []);

  return { done, toggle };
}

export function ProgressPill({ total }: { total: number }) {
  const { done } = useDone();
  const finished = done.filter((s) => s.length > 0).length;
  const pct = total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;
  return (
    <span className="progress-pill" title="学习进度只保存在你自己的浏览器里">
      已学 {finished}/{total}
      <span className="progress-bar">
        <i style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

export function MarkDone({ slug }: { slug: string }) {
  const { done, toggle } = useDone();
  const isDone = done.includes(slug);
  return (
    <div className="done-toggle">
      <button
        type="button"
        className={`btn btn-sm ${isDone ? "btn-line" : "btn-primary"}`}
        onClick={() => toggle(slug)}
      >
        {isDone ? "✓ 已学完（点一下取消）" : "标记这节课已学完"}
      </button>
      <span>进度只存在你的浏览器本地，不上传、不登录。</span>
    </div>
  );
}

export function DoneBadge({ slug }: { slug: string }) {
  const { done } = useDone();
  if (!done.includes(slug)) return null;
  return (
    <span
      className="badge"
      style={{ background: "#ecfdf5", color: "#047857" }}
      title="已标记为学完"
    >
      ✓ 已学
    </span>
  );
}
