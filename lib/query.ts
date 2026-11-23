import type { Category, KnowledgeItem } from "./types";

export function sortByTime(items: KnowledgeItem[]): KnowledgeItem[] {
  return [...items].sort((a, b) => {
    const diff = b.publishedAt.localeCompare(a.publishedAt);
    return diff !== 0 ? diff : b.crawledAt.localeCompare(a.crawledAt);
  });
}

export interface FilterOptions {
  q?: string;
  category?: Category | "all";
  level?: "入门" | "进阶" | "all";
  source?: string;
}

export function filterItems(items: KnowledgeItem[], options: FilterOptions): KnowledgeItem[] {
  const q = (options.q || "").trim().toLowerCase();
  return items.filter((item) => {
    if (options.category && options.category !== "all" && item.category !== options.category) {
      return false;
    }
    if (options.level && options.level !== "all" && item.level !== options.level) return false;
    if (options.source && options.source !== "all" && item.source !== options.source) return false;
    if (!q) return true;
    const haystack = [item.title, item.summary, item.source, ...(item.tags || []), ...(item.points || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function countByCategory(items: KnowledgeItem[]): Record<string, number> {
  const counts: Record<string, number> = { all: items.length };
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return counts;
}
