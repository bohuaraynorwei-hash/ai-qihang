import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // 自己在腾讯云 / 自建服务器上跑时用 standalone 输出，产物小、不依赖完整 node_modules
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // ioredis 是原生 TCP 客户端，不要被 bundler 打进去
  serverExternalPackages: ["ioredis"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
