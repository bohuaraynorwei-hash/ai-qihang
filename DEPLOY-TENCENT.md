# 部署到腾讯云

这个平台是标准 Next.js 15 应用，**不依赖 Vercel**，可以完整跑在腾讯云上。本文给出四种方案和各自要改的地方。

## 先看结论

| 方案 | 适合谁 | 成本 | 复杂度 |
| --- | --- | --- | --- |
| **A. 轻量应用服务器 / CVM + PM2**（推荐） | 想省心、要完整控制权 | 约 ¥24-60/月起（新用户常有活动） | ⭐ 低 |
| **B. Docker / docker-compose** | 喜欢容器化、要可复制部署 | 同上 | ⭐⭐ 中 |
| **C. 容器服务 TKE / 云托管** | 要多副本、滚动发布 | 按量，偏贵 | ⭐⭐⭐ 高 |
| **D. 云函数 SCF** | 不想管服务器 | 极低 | ⭐⭐⭐⭐ 高（Next.js 适配麻烦，不推荐） |

**推荐 A**：一台 2 核 2G 的轻量服务器就够跑，配合腾讯云 Redis（或同机 Docker Redis）。

## 和 Vercel 版的三个差异（必须处理）

| 项目 | Vercel 版 | 腾讯云版 |
| --- | --- | --- |
| **存储** | Upstash Redis（HTTP REST） | 腾讯云 Redis 用**标准 RESP 协议**，需配 `REDIS_URL` |
| **定时抓取** | `vercel.json` 里的 Cron | **系统 crontab** 调 `scripts/trigger-crawl.mjs` |
| **HTTPS** | 平台自动 | **Nginx + 腾讯云免费 SSL 证书** |

> 存储这块代码**已经改好了**：现在同时支持 Upstash REST、标准 Redis（`REDIS_URL`）、内存兜底三种模式，自动识别。

---

## 方案 A：轻量应用服务器 + PM2（推荐）

### 1. 买机器

腾讯云控制台 → 轻量应用服务器 → 选 **Ubuntu 22.04 / Debian 12**，2 核 2G 起。
镜像选「纯净系统」，不要选带面板的（或者选宝塔也行，见文末）。

### 2. 装运行环境

```bash
# 用 NodeSource 装 Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx
node -v   # 应 >= 22

sudo npm i -g pm2
```

> 腾讯云内网访问 npm 可能慢，建议配国内镜像：
> `npm config set registry https://registry.npmmirror.com`

### 3. 拉代码并构建

```bash
sudo mkdir -p /opt/ai-qihang && sudo chown $USER /opt/ai-qihang
git clone https://github.com/bohuaraynorwei-hash/ai-qihang.git /opt/ai-qihang
cd /opt/ai-qihang

npm install --no-audit --no-fund
npm run build
```

### 4. 配环境变量

```bash
cp .env.tencent.example .env
nano .env
```

必填四项：

```ini
ADMIN_PASSWORD=你的强密码
CRON_SECRET=随机长串
NEXT_PUBLIC_SITE_URL=https://你的域名
REDIS_URL=redis://:密码@内网IP:6379/0
```

`REDIS_URL` 二选一：
- **用腾讯云 Redis**：控制台 → 云数据库 Redis → 新建（选 1G 主从，最便宜的够用）→ 拿到**内网地址**和密码。⚠️ 必须和 CVM 在**同一个 VPC**。
- **不想买**：用方案 B 的 docker 起一个 Redis，或者直接 `apt install redis-server` 并设密码。

### 5. 第一次启动前自检

```bash
export $(grep -v '^#' .env | xargs)      # 临时加载环境变量
npm run check:redis                       # 验证 Redis 连通与读写
```

看到 `[自检] 读写正常 ✅` 再继续。失败常见原因：安全组没放通 6379、不在同一 VPC、密码错。

### 6. 用 PM2 启动

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup            # 按提示复制粘贴它输出的那行命令，实现开机自启
pm2 logs ai-qihang     # 看日志
```

验证：

```bash
curl http://127.0.0.1:3000/api/health
```

应看到 `"storageBackend":"redis"`。

### 7. 配 Nginx + HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/conf.d/ai-qihang.conf
sudo nano /etc/nginx/conf.d/ai-qihang.conf   # 改 server_name 和证书路径
sudo nginx -t && sudo systemctl reload nginx
```

**证书**：腾讯云 → SSL 证书 → 申请免费证书（DV）→ 下载 **Nginx** 版本 → 把 `.crt` 和 `.key` 传到 `/etc/nginx/ssl/`。

### 8. 配定时抓取

```bash
crontab -e
```

粘入（把密钥换成你的）：

```cron
30 8 * * * cd /opt/ai-qihang && SITE_URL=http://127.0.0.1:3000 CRON_SECRET=你的密钥 /usr/bin/node scripts/trigger-crawl.mjs >> /var/log/ai-qihang-crawl.log 2>&1
```

腾讯云 CVM 默认时区是 `Asia/Shanghai`，所以 `30 8` 就是北京时间 08:30。想每 6 小时跑：

```cron
30 0,6,12,18 * * * cd /opt/ai-qihang && SITE_URL=http://127.0.0.1:3000 CRON_SECRET=你的密钥 /usr/bin/node scripts/trigger-crawl.mjs >> /var/log/ai-qihang-crawl.log 2>&1
```

手动测一次：

```bash
cd /opt/ai-qihang && SITE_URL=http://127.0.0.1:3000 CRON_SECRET=你的密钥 node scripts/trigger-crawl.mjs
```

### 9. 上线后配大模型

浏览器打开 `https://你的域名/admin`，输入 `ADMIN_PASSWORD` → 填大模型 API（DeepSeek：`https://api.deepseek.com/v1` + `deepseek-chat`）→ 点「测试连接」→「立即抓取一次」。

---

## 方案 B：Docker / docker-compose

### 只跑应用（Redis 用腾讯云的）

```bash
cd /opt/ai-qihang
cp .env.tencent.example .env && nano .env    # REDIS_URL 指向腾讯云 Redis
docker build -t ai-qihang .
docker run -d --name ai-qihang --restart unless-stopped \
  -p 127.0.0.1:3000:3000 --env-file .env ai-qihang
```

### 应用 + Redis 一起跑（单机最省事）

```bash
cp .env.tencent.example .env
nano .env     # 至少改 ADMIN_PASSWORD / CRON_SECRET / NEXT_PUBLIC_SITE_URL / REDIS_PASSWORD
docker compose up -d --build
docker compose logs -f app
```

`docker-compose.yml` 里 Redis 只开了容器内端口，不对外暴露，并启用了 AOF 持久化。

镜像用了 `output: standalone`，最终约 200MB，非 root 运行，自带 healthcheck。

---

## 方案 C：容器服务 TKE / 云托管

要点：

1. 用仓库里的 `Dockerfile` 构建镜像，推到**腾讯云容器镜像服务 TCR**。
2. TKE 部署时环境变量按 `.env.tencent.example` 配，`REDIS_URL` 指向云 Redis 内网地址。
3. **健康检查**配 `GET /api/health`（已内建，返回 200 即健康）。
4. 副本数 > 1 时**必须**用外部 Redis（不能用内存模式），否则各副本数据不一致。
5. 定时抓取不要在容器里跑 crontab（会被重启打乱），改用：
   - TKE 的 **CronJob**
   - 或腾讯云 **弹性容器服务 / 云函数** 定时 HTTP 调用 `/api/cron/crawl?secret=xxx`

---

## 方案 D：云函数 SCF（不推荐）

Next.js 的 App Router 依赖文件系统缓存和 `node_modules` 结构，塞进 SCF 需要自己做一层适配（每个路由打成一个函数），维护成本高。**除非你完全不想要服务器，否则不建议。**

如果一定要用，更现实的组合是：**静态导出** + SCF 只跑 `/api/*`。但本站的知识库页面是动态渲染的，静态导出要改不少代码，不建议。

---

## 迁移过来之后要检查的清单

```bash
# 1. 存储后端对不对
curl -s https://你的域名/api/health?deep=1 | jq
#   期望: "storageBackend":"redis", "storagePing":{"ok":true}

# 2. 管理台能登进去
#    https://你的域名/admin → 输密码

# 3. 抓取能跑
curl "https://你的域名/api/cron/crawl?secret=你的CRON_SECRET" | jq '.report.added'

# 4. 定时任务已生效
tail -f /var/log/ai-qihang-crawl.log

# 5. RSS 和 sitemap 正常
curl -I https://你的域名/feed.xml
curl -I https://你的域名/sitemap.xml
```

---

## 常见问题

**Q：`storageBackend` 显示 `memory`？**
`REDIS_URL` 没生效。检查：变量是否写进 `.env`、PM2 是否重启过（`pm2 restart ai-qihang --update-env`）、`REDIS_URL` 是否以 `redis://` 或 `rediss://` 开头。

**Q：连不上腾讯云 Redis？**
按顺序排查：① 两者是否同一 VPC／同一地域；② Redis 实例是否允许内网访问；③ 安全组是否放通 6379；④ 用 `npm run check:redis` 看具体报错。

**Q：页面能开但抓取超时？**
Nginx 的 `proxy_read_timeout` 要 ≥ 120s（示例里已配）。抓取最慢约 60 秒。

**Q：构建时内存不够（`Killed`）？**
2G 机器跑 `next build` 偶尔会 OOM。加 swap：
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Q：以后还想回到 Vercel？**
不用改代码。Vercel 上用 Upstash（`KV_REST_API_*`），腾讯云上用 `REDIS_URL`，两套变量互不干扰，代码自动识别。

**Q：用宝塔面板可以吗？**
可以。把 Node 项目导入宝塔，启动命令填 `npm run start`，端口 3000；在「网站 → 反向代理」指向 `http://127.0.0.1:3000`；计划任务里加一条 Shell 脚本跑 `trigger-crawl.mjs`。环境变量写在项目目录的 `.env` 里。
