# AI 启航 · 零基础 AI 学习平台

一个部署在 [Vercel](https://vercel.com) 上的中文 AI 学习平台：给**完全零基础**的用户讲清楚「提示词 / Agent / Skill」，配一个**每天自动更新**的 AI 知识库（全网 RSS 抓取 + 大模型中文摘要），并提供一个可视化**管理台**来配置数据源和爬虫用的大模型 API。

## 一键部署到 Vercel

先把本项目推到你的 GitHub 仓库（公开即可），按钮已按你的账号 `bohuaraynorwei-hash` 配置好：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbohuaraynorwei-hash%2Fai-qihang&env=ADMIN_PASSWORD&env=CRON_SECRET&project-name=ai-qihang&repository-name=ai-qihang)

点按钮后按 Vercel 引导走完即可，一共三步：

1. **填环境变量**：按钮已带上 `ADMIN_PASSWORD`（管理台密码）和 `CRON_SECRET`（随便一串随机字符），Vercel 会自动弹出输入框让你填。
2. **Deploy**：等 1 分钟左右构建完成，应用就上线了。
3. **接 Redis（必须，否则知识库不保存）**：项目 → Storage → 新建 **Upstash Redis**（自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN`），然后 **Redeploy** 一次。

> 部署后访问 `/admin`，填大模型 API（可选），点「立即抓取一次」即可看到每日知识库开始更新。定时抓取（`vercel.json` 里的 Cron）在免费版每天只跑一次；想要更频繁，用仓库里的 `.github/workflows/crawl.yml`。

> ⚠️ 建议再设一个 `NEXT_PUBLIC_SITE_URL`（你的正式域名，如 `https://你的项目.vercel.app`），用于 sitemap 和 RSS 里的绝对链接。

> 🖥 **不想用 Vercel？** 平台不依赖 Vercel，可以完整部署到腾讯云 / 阿里云 / 自建服务器。见 [DEPLOY-TENCENT.md](DEPLOY-TENCENT.md)（含轻量服务器、Docker、TKE 三种方案）。

## 存储后端：三种模式自动识别

| 场景 | 配置 | 说明 |
| --- | --- | --- |
| Vercel + Upstash | `KV_REST_API_URL` + `KV_REST_API_TOKEN` | HTTP REST 协议 |
| 腾讯云 / 自建 Redis | `REDIS_URL=redis://:密码@host:6379/0` | 标准 RESP 协议（ioredis） |
| 都没配 | — | 退化为内存，重启就丢（仅本地调试用） |

代码会按上表顺序自动选择，不用改任何代码。部署前可跑 `npm run check:redis` 验证连通与读写。

## 功能一览

| 模块 | 说明 |
| --- | --- |
| **学习路径** `/learn` | 10 节课，从「先用起来」到「设计自己的 Agent/Skill」，含练习与 30 天计划 |
| **每日知识库** `/knowledge` | RSS 抓取 → 去重 → 关键词过滤 → 大模型写中文摘要，支持搜索/分类筛选/分页 |
| **模板库** `/library` | 11 个提示词 + 6 个 Agent 方案 + 5 个 Skill 说明书，一键复制 |
| **术语表** `/glossary` | 26 个术语，每词一句人话解释 |
| **管理台** `/admin` | 配数据源、配大模型 API、手动抓取、查看报告、清空数据 |
| **RSS 订阅** `/feed.xml` | 知识库对外输出 RSS，可订阅进阅读器 |
| **SEO** | `sitemap.xml` / `robots.txt` / 动态 `metadata` |

## 技术栈

- **Next.js 15**（App Router）+ React 19 + TypeScript（严格模式）
- **零前端依赖**：手写 CSS，不用 Tailwind，构建更稳
- **零解析依赖**：RSS/Atom 解析、Markdown 渲染都是自写，少一层供应链风险
- **存储**：Upstash Redis（REST 协议，无 SDK）；未配置时降级为内存 + 冷启动种子内容
- **大模型**：任何 OpenAI 兼容接口（DeepSeek / OpenAI / Moonshot / 通义 / Ollama 网关等）

## 目录结构

```
app/
  page.tsx                首页
  learn/                  学习路径 + 课程详情（SSG）
  knowledge/              知识库列表 + 详情（动态）
  library/                模板库
  glossary/               术语表
  admin/                  管理台
  api/
    cron/crawl/           定时抓取（Vercel Cron 调用）
    crawl/                手动抓取（管理台调用）
    admin/config/         配置读写
    admin/test-llm/       大模型连通性测试
    admin/items/          清空数据
    knowledge/            知识库 JSON（给前端/第三方用）
    health/               健康检查
  feed.xml/               知识库 RSS
lib/
  crawler.ts              抓取编排（并发、去重、公平轮转、摘要）
  rss.ts                  RSS/Atom 解析
  llm.ts                  OpenAI 兼容调用 + JSON 提取
  store.ts                Redis / 内存存储适配
  defaults.ts             默认数据源与配置
  curriculum.ts           课程内容（纯数据，加课直接加数组）
  library.ts / glossary.ts / seed.ts
components/
  admin-app.tsx           管理台（客户端）
```

## 本地运行

要求 Node ≥ 18。Windows 下若 `pnpm install` 报 `EBUSY`（符号链接被占用），用项目里已配好的 `.npmrc`（`node-linker=hoisted` + 复制方式安装）：

```bash
pnpm install
cp .env.example .env.local   # 填上 ADMIN_PASSWORD 等
pnpm dev                     # http://localhost:3000
```

生产模式验证：

```bash
pnpm build && pnpm start
```

## 自检脚本

部署后建议跑一遍，用来防止回归：

```bash
# 检查线上 31 节课的「下一课 / 下一阶段」是否与学习路径顺序一致
SITE_URL=https://你的域名 node scripts/test-nav.mjs

# 检查 Redis 连通与读写（部署前跑）
REDIS_URL=redis://:密码@IP:6379/0 node scripts/check-redis.mjs

# 手动触发一次抓取（cron 同款逻辑）
SITE_URL=https://你的域名 CRON_SECRET=xxx node scripts/trigger-crawl.mjs
```

> **关于课程顺序**：课程按「阶段」分组渲染，而 `LESSONS` 数组里的顺序和阶段顺序**不一定相同**（补加的课会接在数组末尾）。
> 因此顺序的唯一来源是 `lib/curriculum.ts` 里的 `ORDERED_LESSONS`；前后课导航、课序号、侧边栏都必须用它，
> 不要直接用 `LESSONS` 的下标。`scripts/test-nav.mjs` 就是守这条规则的。

## 部署到 Vercel

> 想一步到位，用上面的 **一键部署按钮** 即可；下面是无按钮的逐步说明（也适合二次部署/换项目名）。

### 第 1 步：推到 GitHub

把整个目录初始化成 git 仓库并推送（`.env*` 已被 gitignore，不会泄露密钥）：

```bash
git init && git add . && git commit -m "init: ai-qihang"
git branch -M main && git remote add origin <你的仓库地址> && git push -u origin main
```

### 第 2 步：导入 Vercel

1. 打开 [vercel.com/new](https://vercel.com/new)，Import 这个仓库。
2. Framework 自动识别为 **Next.js**，直接 Deploy。

### 第 3 步：加一个免费的 Redis（关键，否则抓取不持久化）

1. Vercel 项目 → **Storage** → 选 **Upstash Redis** → Create。
2. 它会自动注入 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 两个环境变量。
3. 或者你自己在 Upstash 开一个免费实例，手动填这两个变量（也支持 `UPSTASH_REDIS_REST_URL/TOKEN`）。

### 第 4 步：配环境变量（Settings → Environment Variables）

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | ✅ | 管理台 `/admin` 登录密码，设个长的 |
| `CRON_SECRET` | ✅ | 定时任务密钥，随机长串即可 |
| `NEXT_PUBLIC_SITE_URL` | 建议 | 你的正式域名，如 `https://ai-qihang.vercel.app`（用于 sitemap/RSS） |
| `KV_REST_API_URL` | ✅ | Upstash Redis 地址（Vercel 部署用） |
| `KV_REST_API_TOKEN` | ✅ | Upstash Redis Token（Vercel 部署用） |
| `REDIS_URL` | 视部署 | 腾讯云/自建 Redis 时用它代替上面两个 |
| `LLM_BASE_URL` | 可选 | 兜底用的大模型地址（更推荐在管理台配，随时改） |
| `LLM_API_KEY` | 可选 | 兜底用的大模型 Key |
| `LLM_MODEL` | 可选 | 模型名 |

> 填完环境变量后需要 **Redeploy** 才生效。

### 第 5 步：配置并手动抓一次

1. 访问 `https://你的域名/admin`，输入 `ADMIN_PASSWORD`。
2. **大模型 API**：填 OpenAI 兼容接口（例：`https://api.deepseek.com/v1` + `deepseek-chat`），点「测试连接」确认。
   - 不填也能用，只是摘要直接用原文，中文源没问题、英文源标题保持英文。
3. 点 **立即抓取一次**，等 10~60 秒，看到报告「新增 N 条」即成功。
4. 回 `/knowledge` 看结果。

### 第 6 步：定时更新

`vercel.json` 里已配置 Cron：每天 **UTC 00:30（北京时间 08:30）** 跑一次。

- **Hobby（免费）套餐**：Cron 每天最多一次。想更频繁，用仓库里现成的 [`.github/workflows/crawl.yml`](.github/workflows/crawl.yml)（每 6 小时），在 GitHub Secrets 配 `SITE_URL` 和 `CRON_SECRET` 即可。
- **Pro 套餐**：可在 `vercel.json` 里改成更密的 `schedule`。

## 管理台 / 爬虫用的 API

| 端点 | 方法 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `/api/cron/crawl` | GET | `CRON_SECRET` | 定时抓取（Vercel Cron 自动带 Bearer） |
| `/api/crawl` | POST | `x-admin-password` | 手动抓取，body 可选 `{"maxItems":20,"sourceIds":["openai"]}` |
| `/api/admin/config` | GET/PUT | `x-admin-password` | 读写配置 |
| `/api/admin/test-llm` | POST | `x-admin-password` | 测试大模型连通性 |
| `/api/admin/items` | DELETE | `x-admin-password` | 清空抓取条目 |
| `/api/knowledge` | GET | 无 | 知识库 JSON，`?q=&category=&limit=&offset=` |
| `/api/health` | GET | 无 | 健康检查 |
| `/feed.xml` | GET | 无 | 知识库 RSS |

手动触发示例：

```bash
curl -X POST https://你的域名/api/crawl \
  -H 'x-admin-password: 你的密码' \
  -H 'Content-Type: application/json' \
  -d '{"maxItems":20}'
```

## 抓取是怎么设计的

1. **只抓公开 RSS/Atom**：数据源全部是可订阅的 feed，不爬渲染后的网页，避开反爬与版权风险。
2. **去重**：按规范化 URL 生成稳定 id（去掉 utm 等跟踪参数），已有条目不重复入库。
3. **公平轮转**：每个源独立限流（`maxPerSource`），再按「发布时间 + 来源轮转」挑最终条目，避免某个更新频繁的源霸屏。
4. **AI 过滤**：泛科技源（如 Hacker News）用**整词匹配**的关键词过滤，避免 `ai` 误命中 `paid`/`email` 这类单词。
5. **大模型摘要**：每批 6 条喂给模型，输出中文标题/摘要/要点/分类/标签/难度；模型不可用时回退为「原文标题 + 截断摘要」。
6. **安全**：抓取地址拒绝内网/本机（SSRF 防护）；管理台密码 `timingSafeEqual` 比对；API Key 不回传明文；单次函数 `maxDuration=60s`。

## 内容怎么维护

- **加课程**：改 [`lib/curriculum.ts`](lib/curriculum.ts)，往 `LESSONS` 数组 push 一项，页面自动生成、自动进 sitemap。
- **加模板**：改 [`lib/library.ts`](lib/library.ts)。
- **加术语**：改 [`lib/glossary.ts`](lib/glossary.ts)。
- **加/删数据源**：管理台直接改，或改 [`lib/defaults.ts`](lib/defaults.ts) 的 `DEFAULT_SOURCES`。
- **冷启动内容**：[`lib/seed.ts`](lib/seed.ts)，第一次部署、还没抓取时也能看到东西；抓取后这些精选内容会一直保留合并展示。

## 常见问题

**Q：抓取报告里某个源 `解析到 0 条`？**
该地址可能不是 RSS（是普通网页）、被反爬拦了、或返回了 JSON。在管理台换成该站真正的 feed 地址即可。

**Q：大模型测试报 401/404？**
Base URL 或 Key 不对。试把 Base URL 写成 `https://api.deepseek.com/v1`（带不带 `/v1` 都行，程序会自动补）。404/405 时会自动尝试加 `/v1` 重试一次。

**Q：知识库刷新后就空了？**
说明没配 Redis。Vercel 函数是无状态的，必须接 Upstash Redis 才能持久化。

**Q：定时任务没跑？**
免费套餐 Cron 每天只跑一次；确认已填 `CRON_SECRET` 并 Redeploy；也可以用 GitHub Actions 那条工作流做补充。

**Q：本地 `pnpm install` 报 `EBUSY`？**
Windows 上符号链接被占用，项目 `.npmrc` 已设 `node-linker=hoisted`，直接用 `pnpm install` 即可；仍失败就重试一次。

## 合规提示

- 只做摘要与链接，不存原文全文；条目页与页脚都标注「版权归原作者，本站仅做导航」。
- 抓取对象请遵守目标站点的 robots.txt / 服务条款，本站默认数据源均为公开 RSS 订阅。
- 大模型生成的摘要可能有偏差，页面上已明确提示，涉及具体数字/政策/价格请核对原文。

## 许可证

MIT。课程与模板内容可自由使用；数据源抓取内容的版权归各自原作者所有。
