import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ai-qihang.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AI 启航 · 零基础学会用 AI",
    template: "%s · AI 启航",
  },
  description:
    "给零基础用户的 AI 学习平台：提示词、Agent、Skill 由浅入深，配今天就能抄的模板，知识库每天自动更新 AI 新闻与使用技巧。",
  keywords: [
    "AI 入门",
    "提示词",
    "Prompt",
    "Agent",
    "AI Agent",
    "Skill",
    "AI 学习",
    "AI 新闻",
  ],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "AI 启航",
    title: "AI 启航 · 零基础学会用 AI",
    description:
      "提示词、Agent、Skill 三条主线，配每日更新的 AI 知识库。不用懂技术，从今天的一件小事开始。",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b1024",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader />
        <main className="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
