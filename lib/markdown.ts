const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

/** 提取 h2/h3 标题，用于课程页右侧目录 */
export function extractHeadings(markdown: string): { level: number; text: string; id: string }[] {
  const out: { level: number; text: string; id: string }[] = [];
  let inCode = false;
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^```/.test(raw)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = raw.match(/^(#{2,3})\s+(.*)$/);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), id: slugify(m[2].trim()) });
  }
  return out;
}

function inline(text: string): string {
  let s = escapeHtml(text);
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (match, label: string, href: string) =>
      /^https?:\/\//i.test(href)
        ? `<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`
        : match
  );
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, n: string) => `<code>${codes[Number(n)]}</code>`);
  return s;
}

/**
 * 极简 Markdown 渲染（标题/段落/列表/表格/代码块/引用/分隔线/常用行内样式）。
 * 输入是我们自己仓库里的课程内容，输出前统一转义，避免 XSS。
 */
export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const isBlockStart = (line: string, next?: string) =>
    /^```/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^---+$/.test(line.trim()) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    (line.includes("|") && !!next && /^\|?[\s:|-]+\|?$/.test(next.trim()) && next.includes("-"));

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // 代码块
    const fence = line.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const lang = fence[1];
      const buffer: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buffer.push(lines[i]);
        i++;
      }
      i++; // 跳过结束的 ```
      out.push(
        `<pre class="md-code"${
          lang ? ` data-lang="${escapeHtml(lang)}"` : ""
        }><code>${escapeHtml(buffer.join("\n"))}</code></pre>`
      );
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      out.push(`<h${level} id="${slugify(text)}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // 分隔线
    if (/^---+$/.test(line.trim())) {
      out.push('<hr class="md-hr" />');
      i++;
      continue;
    }

    // 引用块
    if (/^>\s?/.test(line)) {
      const buffer: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buffer.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const inner = buffer
        .map((l) => (l.trim() ? `<p>${inline(l)}</p>` : ""))
        .join("");
      out.push(`<blockquote class="md-quote">${inner}</blockquote>`);
      continue;
    }

    // 表格
    if (line.includes("|") && lines[i + 1] && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim()) && lines[i + 1].includes("-")) {
      const headCells = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${headCells.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      out.push(`<div class="md-table-wrap"><table class="md-table">${thead}${tbody}</table></div>`);
      continue;
    }

    // 无序列表（支持二级缩进）
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: { indent: number; text: string }[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[-*+]\s+(.*)$/)!;
        items.push({ indent: m[1].length, text: m[2] });
        i++;
      }
      out.push(renderList(items));
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      out.push(`<ol class="md-ol">${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ol>`);
      continue;
    }

    // 段落
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i], lines[i + 1])) {
      paragraph.push(lines[i]);
      i++;
    }
    if (paragraph.length === 0) {
      // 兜底：避免死循环
      paragraph.push(lines[i] ?? "");
      i++;
    }
    out.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return out.join("\n");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function renderList(items: { indent: number; text: string }[]): string {
  let html = "";
  let depth = -1;
  for (const item of items) {
    const level = item.indent >= 2 ? 1 : 0;
    if (level > depth) {
      html += `<ul class="md-ul">`;
      depth = level;
    } else if (level < depth) {
      html += `</li></ul></li>`;
      depth = level;
    } else {
      html += `</li>`;
    }
    html += `<li>${inline(item.text)}`;
  }
  while (depth >= 0) {
    html += `</li></ul>`;
    depth--;
  }
  return html;
}
