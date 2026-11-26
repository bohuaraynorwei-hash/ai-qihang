import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <div style={{ fontWeight: 700, color: "#1f2738", marginBottom: 6 }}>
            AI 启航 · 游戏本地化的 AI 工作台
          </div>
          <div>
            只讲本地化要用的东西：术语表、上下文翻译、多语言对照、增量流水线。
            知识库由定时任务每日抓取公开 RSS 自动更新。
            <br />
            所有信息仅供参考，涉及钱、健康、法律的事情请找专业来源二次确认。
          </div>
        </div>
        <div className="footer-links">
          <Link href="/learn">学习路径</Link>
          <Link href="/knowledge">知识库</Link>
          <Link href="/library">模板库</Link>
          <Link href="/glossary">术语表</Link>
          <Link href="/feed.xml">RSS 订阅</Link>
          <Link href="/admin">管理台</Link>
        </div>
      </div>
      <div className="container" style={{ marginTop: 24, fontSize: 12.5, color: "#9aa1b3" }}>
        © {year} AI 启航 · 内容基于公开信息整理，抓取内容版权归原作者所有，本站仅做摘要与链接。
      </div>
    </footer>
  );
}
