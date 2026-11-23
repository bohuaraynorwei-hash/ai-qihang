import type { MetadataRoute } from "next";
import { LESSONS } from "@/lib/curriculum";
import { getItems } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://ai-qihang.vercel.app").replace(/\/$/, "");
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/learn`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/knowledge`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/library`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/glossary`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const lessons: MetadataRoute.Sitemap = LESSONS.map((lesson) => ({
    url: `${base}/learn/${lesson.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  let knowledge: MetadataRoute.Sitemap = [];
  try {
    const items = await getItems();
    knowledge = items.slice(0, 300).map((item) => ({
      url: `${base}/knowledge/${item.id}`,
      lastModified: new Date(item.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
  } catch {
    knowledge = [];
  }

  return [...pages, ...lessons, ...knowledge];
}
