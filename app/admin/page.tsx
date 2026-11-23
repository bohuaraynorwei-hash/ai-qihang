import type { Metadata } from "next";
import { AdminApp } from "@/components/admin-app";

export const metadata: Metadata = {
  title: "管理台",
  description: "配置爬虫数据源、大模型 API 与定时抓取。",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminApp />;
}
