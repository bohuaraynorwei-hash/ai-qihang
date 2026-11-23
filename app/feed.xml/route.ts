import { getItems } from "@/lib/store";
import { sortByTime } from "@/lib/query";

export const dynamic = "force-dynamic";

function cdata(input: string): string {
  return `<![CDATA[${input.replace(/]]>/g, "]]&gt;")}]]>`;
}

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://ai-qihang.vercel.app").replace(/\/$/, "");
  const items = sortByTime(await getItems()).slice(0, 40);

  const entries = items
    .map(
      (item) => `    <item>
      <title>${cdata(item.title)}</title>
      <link>${base}/knowledge/${item.id}</link>
      <guid isPermaLink="false">${item.id}</guid>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
      <category>${cdata(item.category)}</category>
      <description>${cdata(item.summary)}</description>
      <source url="${item.url}">${cdata(item.source)}</source>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI 启航 · 每日知识库</title>
    <link>${base}/knowledge</link>
    <description>每天自动更新的 AI 新闻、使用技巧、工具与解读，面向零基础读者。</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${base}/feed.xml" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
