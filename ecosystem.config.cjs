// PM2 配置：在腾讯云 CVM / 轻量应用服务器上用 systemd 更省心，但 PM2 更简单。
// 用法：
//   npm i -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup    # 开机自启
module.exports = {
  apps: [
    {
      name: "ai-qihang",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1, // 内存小的机器用 1；有 Redis 后可调成 "max" 走 cluster
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      max_memory_restart: "600M",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      time: true,
      // 优雅重启，避免正在抓取时被硬杀
      kill_timeout: 10000,
      wait_ready: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
