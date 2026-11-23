import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container" style={{ paddingTop: 100, textAlign: "center" }}>
      <div style={{ fontSize: 60, fontWeight: 850, color: "#c7cbe0" }}>404</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>这个页面不存在</h1>
      <p style={{ color: "var(--muted)", marginTop: 10 }}>
        可能是链接过期了，或者知识库条目被清理掉了。
      </p>
      <div className="copy-row" style={{ justifyContent: "center", marginTop: 22 }}>
        <Link href="/" className="btn btn-primary">
          回首页
        </Link>
        <Link href="/knowledge" className="btn btn-line">
          去知识库
        </Link>
      </div>
    </div>
  );
}
