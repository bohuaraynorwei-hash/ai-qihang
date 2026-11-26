import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ai-qihang.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AI 启航 · 游戏本地化的 AI 工作台",
    template: "%s · AI 启航",
  },
  description:
    "只讲游戏本地化要用的 AI：术语表、上下文翻译、多语言对照、增量流水线与独立质检。31 节课走完一条路，配可直接复制的模板和一套能跑的增量工具包。",
  keywords: [
    "游戏本地化",
    "本地化",
    "L10n",
    "i18n",
    "翻译",
    "术语表",
    "多语言",
    "增量翻译",
    "AI 本地化",
    "DeepSeek Harness",
  ],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "AI 启航",
    title: "AI 启航 · 游戏本地化的 AI 工作台",
    description:
      "术语表、上下文翻译、多语言对照、增量流水线。一条路走完，不用挑方向。",
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
