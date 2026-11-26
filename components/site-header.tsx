"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/learn", label: "学习路径", hideSm: false },
  { href: "/knowledge", label: "每日知识库", hideSm: false },
  { href: "/library", label: "模板库", hideSm: false },
  { href: "/glossary", label: "术语表", hideSm: true },
];

export function SiteHeader() {
  const pathname = usePathname() || "/";

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand" aria-label="AI 启航 首页">
          <span className="brand-mark">启</span>
          <span>
            AI 启航
            <small>游戏本地化 · 每日更新</small>
          </span>
        </Link>
        <nav className="nav-links" aria-label="主导航">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " active" : ""}${item.hideSm ? " hide-sm" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link href="/learn" className="nav-cta">
            开始学
          </Link>
        </nav>
      </div>
    </header>
  );
}
