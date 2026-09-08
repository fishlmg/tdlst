# tdlst — 跨平台收藏夹 → 执行力引擎

一个 Next.js 应用：粘贴你收藏的链接（抖音 / 小红书 / B站 / 知乎 / 公众号等），自动提取网页正文，调用 Kimi（月之暗面）大模型生成可执行的 TODO，存入 Supabase 并跟踪完成状态。

> 产品设计理念与完整路线图见 `灵感一.md`。

## 技术栈

- **Next.js 14**（App Router + TypeScript）
- **Supabase**（阿里云托管 Supabase 兼容服务，Postgres 数据库）
- **Kimi / Moonshot AI**（网页内容 → TODO 的智能总结）
- **JSDOM + @mozilla/readability**（正文提取）

## 安全设计

- `lib/extract.ts` 在服务端抓取页面前做 DNS 解析，拦截 loopback / RFC1918 / link-local / 云元数据地址（SSRF 防护），手动处理重定向并逐跳校验
- 所有密钥通过环境变量注入，仓库中不含任何真实凭证

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.local.example .env.local
# 在 .env.local 中填入 KIMI_API_KEY、SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY

# 3. 在 Supabase 项目中执行 supabase/schema.sql 建表

# 4. 启动
npm run dev
```

## 文件结构

```
app/           # 页面与 API 路由
lib/
├── extract.ts   # 网页正文提取（含 SSRF 防护）
├── kimi.ts      # Kimi 大模型调用
└── supabase.ts  # Supabase 客户端
supabase/
└── schema.sql   # 数据库建表脚本
```
