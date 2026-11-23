#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增量本地化工具（l10n.py）
========================

把「全量表 → 增量 → 四件套翻译 → 机检 QA → 锁定回写」这条流水线做成一个命令行工具。

用法：
    python l10n.py diff      # 从全量表和新源文算出增量表
    python l10n.py translate # 用四件套（术语表+风格指导+全量表上下文+checklist）翻译增量
    python l10n.py qa        # 对译文做机械质检（漏译/占位符/术语/长度/夹带英文）
    python l10n.py lock      # 质检通过后回写全量表并锁定
    python l10n.py run       # 一键：diff → translate → qa → lock

依赖：仅 openpyxl（读写 xlsx；csv 用标准库）。大模型接口用 OpenAI 兼容协议。
详细说明见 README.md。
"""

import argparse
import csv
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

# Windows 控制台默认不是 UTF-8，中文输出会乱码
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# ---------------------------------------------------------------- 表格读写

def load_table(path):
    """读 xlsx 或 csv。返回 (列名列表, 行列表)。每个单元格统一转成去空白字符串。"""
    if not os.path.exists(path):
        sys.exit(f"[错误] 找不到文件：{path}")
    if path.lower().endswith(".csv"):
        with open(path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            cols = [c or "" for c in (reader.fieldnames or [])]
            rows = [{k: (v or "").strip() for k, v in r.items()} for r in reader]
        return cols, rows

    from openpyxl import load_workbook

    wb = load_workbook(path, data_only=True)
    ws = wb.active
    raw = list(ws.iter_rows(values_only=True))
    if not raw:
        return [], []
    cols = [str(c) if c is not None else "col%d" % i for i, c in enumerate(raw[0])]
    rows = []
    for r in raw[1:]:
        if r is None or all(v is None or str(v).strip() == "" for v in r):
            continue
        rows.append({cols[i]: ("" if r[i] is None else str(r[i]).strip()) for i in range(len(cols))})
    return cols, rows


def save_table(path, cols, rows):
    """写 xlsx 或 csv。"""
    if path.lower().endswith(".csv"):
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            writer.writeheader()
            for r in rows:
                writer.writerow({c: r.get(c, "") for c in cols})
        return
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(list(cols))
    for r in rows:
        ws.append([r.get(c, "") for c in cols])
    wb.save(path)


# ---------------------------------------------------------------- 配置

DEFAULT_CONFIG = {
    "api_base": "https://api.deepseek.com/v1",
    "api_key": "",
    "model": "deepseek-chat",
    "source_lang": "英文",
    "target_lang": "简体中文",
    "batch_size": 10,
    "length_ratio": 1.2,
    "key_col": "key",
    "source_col": "source",
    "target_col": "zh",
    "context_col": "context",
    # key 以这些后缀结尾的条目视为专有名词（技能名/道具名/角色名），
    # 按风格指导保留英文原名，QA 不对它做「夹带英文/漏译」判定
    "proper_noun_suffixes": ["_name", "_title", "_id"],
    "glossary_file": "glossary.md",
    "style_guide_file": "style-guide.md",
}


def load_config(path, need_key=True):
    cfg = dict(DEFAULT_CONFIG)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            cfg.update(json.load(f))
    # API key 优先读环境变量，其次读配置
    cfg["api_key"] = os.environ.get("DEEPSEEK_API_KEY", "") or cfg.get("api_key", "")
    if need_key and not cfg["api_key"]:
        sys.exit("[错误] 没有 API Key。请在 config.json 里填 api_key，或设置环境变量 DEEPSEEK_API_KEY。")
    for f in ("glossary_file", "style_guide_file"):
        p = cfg.get(f, "")
        if p and not os.path.exists(p):
            sys.exit(f"[错误] 找不到 {f}：{p}")
    return cfg


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------- 增量计算

def compute_delta(full_rows, new_rows, cfg):
    """算增量：新 key = 新增；key 相同但源文变了 = 变更。返回 (added, changed)。"""
    old = {r[cfg["key_col"]]: r for r in full_rows if r.get(cfg["key_col"])}
    added, changed = [], []
    for item in new_rows:
        k = item.get(cfg["key_col"], "")
        if not k:
            continue
        if k not in old:
            added.append(item)
        elif old[k].get(cfg["source_col"], "").strip() != item.get(cfg["source_col"], "").strip():
            changed.append(item)
    return added, changed


# ---------------------------------------------------------------- 术语表 / 占位符

PLACEHOLDER_RE = re.compile(r"\{[^{}]*\}|%[sdft]|\\n|\\t")


def placeholders(text):
    return sorted(PLACEHOLDER_RE.findall(text or ""))


def ascii_ratio(text):
    if not text:
        return 0.0
    letters = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    return letters / max(1, len(text))


def parse_glossary(text):
    """从术语表 markdown 里解析「英文 | 中文 | …」行，返回 [(英文, 中文), …]。"""
    terms = []
    for line in text.splitlines():
        line = line.strip()
        if "|" not in line:
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 2:
            continue
        en, zh = parts[0], parts[1]
        if not en or not zh:
            continue
        if re.fullmatch(r"[A-Za-z0-9 .,'\-/]+", en) and re.search(r"[\u4e00-\u9fa5]", zh):
            terms.append((en, zh))
    return terms


# ---------------------------------------------------------------- 大模型调用

def call_llm(prompt, cfg):
    endpoint = cfg["api_base"].rstrip("/") + "/chat/completions"
    payload = json.dumps({
        "model": cfg["model"],
        "messages": [
            {"role": "system", "content": "你是本地化翻译引擎。只输出要求的格式，不要任何解释和多余文字。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }).encode("utf-8")
    req = urllib.request.Request(endpoint, data=payload, headers={
        "Authorization": "Bearer " + cfg["api_key"],
        "Content-Type": "application/json",
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            return body["choices"][0]["message"]["content"]
        except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"  [重试 {attempt + 1}/3] 调用失败：{e}", file=sys.stderr)
            time.sleep(2 + attempt * 2)
    sys.exit("[错误] 大模型调用连续失败，请检查 api_base / api_key / 网络。")


def find_context(full_rows, batch_keys, cfg, max_per=5):
    """为增量里的每个 key，从全量表找相关已译条目（key 前两段相同即可）。"""
    def prefix(k, n=2):
        parts = re.split(r"[_.]", k)
        return "_".join(parts[:n])

    wanted = {prefix(k) for k in batch_keys}
    picked = []
    for r in full_rows:
        k = r.get(cfg["key_col"], "")
        if prefix(k) in wanted and r.get(cfg["target_col"], "").strip():
            picked.append(r)
    # 精简：每个前缀最多留 max_per 条
    seen = {}
    out = []
    for r in picked:
        p = prefix(r[cfg["key_col"]])
        if seen.get(p, 0) >= max_per:
            continue
        seen[p] = seen.get(p, 0) + 1
        out.append(r)
    return out


def build_prompt(batch, glossary, style_guide, context_rows, cfg):
    key_c, src_c, ctx_c, tgt_c = cfg["key_col"], cfg["source_col"], cfg["context_col"], cfg["target_col"]
    L = []
    L.append(f"你要翻译一批「增量文本」，源语言{cfg['source_lang']}，目标语言{cfg['target_lang']}。")
    L.append("")
    L.append("【术语表】（必须严格遵循，不得改动译名）：")
    L.append(glossary.strip())
    L.append("")
    L.append("【风格指导】：")
    L.append(style_guide.strip())
    L.append("")
    L.append("【全量表上下文】（已翻译的相似条目，仅作一致性和译法参考，不要修改它）：")
    L.append("key | 源文 | 译文")
    for r in context_rows:
        L.append(f"{r.get(key_c, '')} | {r.get(src_c, '')} | {r.get(tgt_c, '')}")
    L.append("")
    L.append("【增量表】（需要翻译的）key | 源文 | 上下文：")
    for r in batch:
        L.append(f"{r.get(key_c, '')} | {r.get(src_c, '')} | {r.get(ctx_c, '')}")
    L.append("")
    L.append("【checklist】（输出前逐条自查）：")
    L.append("1. 占位符（如 {0}、%s）数量与源文一致。")
    L.append("2. 术语命中术语表。")
    L.append(f"3. 译文长度不超过源文 {cfg['length_ratio']} 倍。")
    L.append("")
    L.append("输出格式：每行一条「key | 源文 | 译文」，只输出这个表格，不要解释、不要 Markdown 包裹。")
    return "\n".join(L)


def parse_translation(text, batch, cfg):
    """把模型返回的「key | 源文 | 译文」解析回 dict。"""
    result = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or "---" in line or set(line) == {"|"}:
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) >= 3 and parts[0]:
            result[parts[0]] = parts[-1]  # 译文取最后一列，源文里带 | 也不怕
    rows = []
    for r in batch:
        k = r.get(cfg["key_col"], "")
        row = dict(r)
        row[cfg["target_col"]] = result.get(k, "")
        rows.append(row)
    return rows


# ---------------------------------------------------------------- 机检 QA

def is_proper_noun(key, cfg):
    """key 形如 skill_03_name 的条目按专有名词处理：保留英文原名是合规的。"""
    k = (key or "").lower()
    return any(k.endswith(s.lower()) for s in cfg.get("proper_noun_suffixes", []))


def mechanical_qa(rows, glossary_terms, cfg):
    """按 checklist 做硬性检查。返回问题列表。"""
    key_c, src_c, tgt_c = cfg["key_col"], cfg["source_col"], cfg["target_col"]
    issues = []
    for r in rows:
        k, src, zh = r.get(key_c, ""), r.get(src_c, "") or "", r.get(tgt_c, "") or ""
        if not zh.strip():
            issues.append({"key": k, "type": "漏译", "severity": "高", "detail": "译文为空"})
            continue
        p_src, p_zh = placeholders(src), placeholders(zh)
        if p_src != p_zh:
            issues.append({"key": k, "type": "占位符", "severity": "高",
                           "detail": f"源 {p_src} 译 {p_zh}"})
        if len(zh) > len(src) * cfg["length_ratio"]:
            issues.append({"key": k, "type": "超长", "severity": "中",
                           "detail": f"译文 {len(zh)} 字符 / 源文 {len(src)}"})

        proper = is_proper_noun(k, cfg)
        # 专有名词保留英文是合规的，不判「夹带英文」，但仍要求「没被翻掉」
        if not proper:
            if ascii_ratio(zh) > 0.6:
                issues.append({"key": k, "type": "疑似漏译/夹带英文", "severity": "中",
                               "detail": zh[:40]})
            for en, cn in glossary_terms:
                if en.lower() in src.lower() and en.lower() not in zh.lower() and cn not in zh:
                    issues.append({"key": k, "type": "术语", "severity": "高",
                                   "detail": f"{en} 应译 {cn}"})
                    break
        else:
            # 专有名词：译文必须仍然包含英文原名（防止被误译成中文）
            if src.strip() and src.strip().lower() not in zh.lower():
                issues.append({"key": k, "type": "专有名词被翻译", "severity": "中",
                               "detail": f"「{src}」按风格指导应保留英文原名"})
    return issues


# ---------------------------------------------------------------- 锁定回写

def lock(full_rows, translated_rows, cfg, locked_by="l10n-tool"):
    """把质检通过的译文回写全量表：合并 + 状态锁定 + 审计。返回新全量表。

    关键：源文变更的条目必须连 source 一起更新，否则下一轮 diff 会永远把它当成「变更」，
    增量永远消不掉。
    """
    key_c, src_c, tgt_c, ctx_c = cfg["key_col"], cfg["source_col"], cfg["target_col"], cfg["context_col"]
    now = datetime.datetime.now().isoformat(timespec="seconds")
    merged = {r.get(key_c): dict(r) for r in full_rows if r.get(key_c)}
    for r in translated_rows:
        k = r.get(key_c)
        if not k:
            continue
        new_src = r.get(src_c, "")
        new_tgt = r.get(tgt_c, "")
        if k not in merged:
            merged[k] = {
                key_c: k,
                src_c: new_src,
                tgt_c: new_tgt,
                ctx_c: r.get(ctx_c, ""),
            }
        else:
            merged[k][src_c] = new_src          # 源文一并更新，否则增量不会消失
            merged[k][tgt_c] = new_tgt
            if r.get(ctx_c):
                merged[k][ctx_c] = r.get(ctx_c)
        merged[k]["status"] = "locked"
        merged[k]["locked_by"] = locked_by
        merged[k]["locked_at"] = now
    return list(merged.values())


# ---------------------------------------------------------------- 命令行

def cmd_diff(args, cfg):
    _, full = load_table(args.full)
    _, new = load_table(args.new)
    added, changed = compute_delta(full, new, cfg)
    delta = added + changed
    cols = [cfg["key_col"], cfg["source_col"], cfg["context_col"]]
    save_table(args.delta, cols, delta)
    print(f"增量计算完成：新增 {len(added)} 条，变更 {len(changed)} 条 → {args.delta}")


def cmd_translate(args, cfg):
    _, delta = load_table(args.delta)
    _, full = load_table(args.full)
    glossary = read_text(cfg["glossary_file"])
    style_guide = read_text(cfg["style_guide_file"])
    keys = [r.get(cfg["key_col"], "") for r in delta]
    context = find_context(full, keys, cfg)
    out_rows = []
    for i in range(0, len(delta), cfg["batch_size"]):
        batch = delta[i : i + cfg["batch_size"]]
        prompt = build_prompt(batch, glossary, style_guide, context, cfg)
        text = call_llm(prompt, cfg)
        parsed = parse_translation(text, batch, cfg)
        empty = [r[cfg["key_col"]] for r in parsed if not r.get(cfg["target_col"], "")]
        if empty:
            print(f"  警告：以下 key 未解析到译文（可能格式不对）：{empty}", file=sys.stderr)
        out_rows.extend(parsed)
        print(f"  已翻译 {min(i + cfg['batch_size'], len(delta))}/{len(delta)} 条")
        time.sleep(1)  # 批间暂停，防限流
    cols = [cfg["key_col"], cfg["source_col"], cfg["context_col"], cfg["target_col"]]
    save_table(args.translated, cols, out_rows)
    print(f"翻译完成 → {args.translated}")


def cmd_qa(args, cfg):
    _, rows = load_table(args.translated)
    glossary = read_text(cfg["glossary_file"])
    terms = parse_glossary(glossary)
    issues = mechanical_qa(rows, terms, cfg)
    high = [i for i in issues if i["severity"] == "高"]
    report = {
        "checked": len(rows),
        "issues": issues,
        "high": len(high),
        "pass": len(high) == 0,
        "checked_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    with open(args.report, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"质检完成：共 {len(rows)} 条，问题 {len(issues)} 处（高 {len(high)}）→ {args.report}")
    for i in issues:
        print(f"  [{i['severity']}] {i['type']} {i['key']}: {i['detail']}")
    if not report["pass"]:
        print("结论：不通过 —— 高严重度问题需先修复，再运行 lock。")


def cmd_lock(args, cfg):
    _, translated = load_table(args.translated)
    _, full = load_table(args.full)
    glossary = read_text(cfg["glossary_file"])
    high = [i for i in mechanical_qa(translated, parse_glossary(glossary), cfg) if i["severity"] == "高"]
    if high:
        sys.exit(f"[中止] 还有 {len(high)} 处高严重度问题，先修复再锁定（可用 qa 命令看详情）。")
    new_full = lock(full, translated, cfg)
    cols = list(dict.fromkeys(
        [cfg["key_col"], cfg["source_col"], cfg["target_col"], cfg["context_col"],
         "status", "locked_by", "locked_at"]
    ))
    save_table(args.out, cols, new_full)
    print(f"锁定完成：{len(translated)} 条已回写并标记 locked → {args.out}")


def cmd_run(args, cfg):
    print("== 1/4 diff ==")
    cmd_diff(args, cfg)
    print("== 2/4 translate ==")
    cmd_translate(args, cfg)
    print("== 3/4 qa ==")
    cmd_qa(args, cfg)
    if not json.load(open(args.report, encoding="utf-8"))["pass"]:
        sys.exit("[中止] QA 未通过，跳过锁定。修复后单独运行 lock。")
    print("== 4/4 lock ==")
    cmd_lock(args, cfg)
    print("完成。下一轮只需要：更新 new_source.xlsx → 再次 run。")


def main():
    p = argparse.ArgumentParser(description="增量本地化流水线工具")
    p.add_argument("cmd", choices=["diff", "translate", "qa", "lock", "run"],
                   help="diff=算增量 translate=翻译 qa=质检 lock=锁定 run=一键全跑")
    p.add_argument("--full", default="full_table.xlsx", help="全量表路径")
    p.add_argument("--new", default="new_source.xlsx", help="新版源文本路径")
    p.add_argument("--delta", default="delta.xlsx", help="增量表输出/输入路径")
    p.add_argument("--translated", default="delta_translated.xlsx", help="译文输出/输入路径")
    p.add_argument("--out", default="full_table_new.xlsx", help="锁定回写后的全量表路径")
    p.add_argument("--config", default="config.json", help="配置文件路径")
    p.add_argument("--report", default="qa_report.json", help="QA 报告路径")
    args = p.parse_args()

    # 只有 translate / run 需要调用大模型；diff、qa、lock 全程本地计算
    need_key = args.cmd in ("translate", "run")
    cfg = load_config(args.config, need_key=need_key)
    {"diff": cmd_diff, "translate": cmd_translate, "qa": cmd_qa,
     "lock": cmd_lock, "run": cmd_run}[args.cmd](args, cfg)


if __name__ == "__main__":
    main()
