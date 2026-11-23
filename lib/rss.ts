/**
 * 不引第三方库的 RSS / Atom / RDF 解析。
 * 覆盖常见结构：RSS 2.0、Atom、带命名空间的 feed（content:encoded、dc:date 等）。
 */

export interface FeedItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  emsp: " ",
  ensp: " ",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.startsWith("#")) {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code < 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function unwrapCdata(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1] : trimmed;
}

export function stripHtml(input: string): string {
  const unwrapped = unwrapCdata(input);
  // 有些 feed 的 summary 是「转义过的 HTML」（&lt;p&gt;），也有直接塞 <p> 的。
  // 先解一层实体，再删标签，再解一层，才能两种都清干净。
  const once = decodeEntities(unwrapped);
  const noTags = once
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(noTags)
    .replace(/\s+/g, " ")
    .trim();
}

function tagValues(block: string, tag: string): string[] {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(m[1]);
  return out;
}

function firstTag(block: string, tags: string[]): string {
  for (const tag of tags) {
    for (const raw of tagValues(block, tag)) {
      const value = stripHtml(raw);
      if (value) return value;
    }
  }
  return "";
}

function pickLink(block: string, feedUrl: string): string {
  // 1) RSS: <link>https://...</link>
  for (const raw of tagValues(block, "link")) {
    const value = unwrapCdata(raw).trim();
    if (value && !value.includes("<") && /^https?:\/\//i.test(value)) return value;
  }
  // 2) Atom: <link rel="alternate" href="..."/>
  const linkTags = block.match(/<link\b[^>]*\/?>/gi) || [];
  const ranked = linkTags
    .map((tag) => {
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1] ?? "";
      const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1] ?? "";
      return { href, rel };
    })
    .filter((x) => /^https?:\/\//i.test(x.href));
  const alternate =
    ranked.find((x) => x.rel === "alternate") ||
    ranked.find((x) => !x.rel) ||
    ranked[0];
  if (alternate) return alternate.href;
  // 3) RSS 老格式: <guid isPermaLink="true">https://...</guid>
  for (const raw of tagValues(block, "guid")) {
    const value = unwrapCdata(raw).trim();
    if (/^https?:\/\//i.test(value)) return value;
  }
  // 4) dc:identifier
  for (const raw of tagValues(block, "dc:identifier")) {
    const value = unwrapCdata(raw).trim();
    if (/^https?:\/\//i.test(value)) return value;
  }
  if (!feedUrl) return "";
  return "";
}

function parseDate(input: string): string | null {
  const value = unwrapCdata(input).trim();
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  const year = new Date(t).getUTCFullYear();
  if (year < 1990 || year > 2100) return null;
  return new Date(t).toISOString();
}

function absolutize(url: string, feedUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, feedUrl).toString();
  } catch {
    return "";
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // 去掉常见跟踪参数
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "ref_src",
      "spm",
    ]) {
      u.searchParams.delete(key);
    }
    const search = u.searchParams.toString();
    return `${u.origin}${u.pathname.replace(/\/$/, "")}${search ? `?${search}` : ""}`;
  } catch {
    return url;
  }
}

export function parseFeed(xml: string, feedUrl: string, limit = 40): FeedItem[] {
  const source = xml.replace(/^\uFEFF/, "");
  const blocks = [
    ...(source.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || []),
    ...(source.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) || []),
  ];
  const items: FeedItem[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const title = firstTag(block, ["title"]);
    const rawLink = pickLink(block, feedUrl);
    const url = absolutize(rawLink, feedUrl);
    if (!title || !url) continue;
    const normalized = normalizeUrl(url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const summary = firstTag(block, [
      "description",
      "summary",
      "content:encoded",
      "content",
      "excerpt",
    ]);
    const published = parseDate(
      firstTag(block, ["pubDate", "published", "updated", "dc:date", "date", "created"])
    );

    items.push({
      title,
      url,
      summary,
      // 没有日期的，先按「现在」处理，后面还会被 maxAgeDays 过滤
      publishedAt: published ?? new Date().toISOString(),
    });
    if (items.length >= limit) break;
  }

  return items;
}
