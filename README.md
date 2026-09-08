# tdlst — 跨平台收藏夹 → 执行力引擎

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

> "收藏从未停止，行动从未开始。"

tdlst 是一个把**收藏链接**转化为**可执行待办**的 Web 应用：粘贴你在抖音 / 小红书 / B站 / 知乎 / 公众号收藏的链接，系统自动提取网页正文，调用 Kimi（月之暗面）大模型总结内容并生成今天就能做的 TODO，存入 Supabase 数据库，跟踪完成状态。

## 📖 项目背景

当代人在各平台收藏了大量内容，但收藏分散、缺少推动力，"收藏即学会"的错觉让收藏夹变成信息坟场。tdlst 的定位不是"帮你存更多"，而是**"帮你把存的东西变成行动"**：

- 链接进来 → AI 读懂内容 → 输出具体动作 → 推送给你执行

## ✨ 特性

- **智能总结**：Kimi 大模型阅读网页正文，生成结构化 TODO（标题 + 摘要 + 待办事项）
- **正文提取**：JSDOM + Mozilla Readability 提取干净正文，自动跟随重定向
- **SSRF 防护**：服务端抓取前做 DNS 解析，拦截回环 / 内网 / 云元数据地址（`169.254.169.254` 等），重定向逐跳校验
- **待办管理**：待办列表、状态切换（待办 / 完成）
- **抓取保护**：15s 超时、5 次重定向上限、5MB 响应体上限

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | Next.js 14（App Router）+ TypeScript |
| 数据库 | Supabase（阿里云托管的 Supabase 兼容服务，Postgres） |
| AI | Kimi / Moonshot AI（OpenAI SDK 兼容接口） |
| 正文提取 | JSDOM + @mozilla/readability |

## 🗂 项目结构

```
.
├── app/
│   ├── page.tsx                    # 首页：待办列表 + 链接提交
│   ├── layout.tsx / globals.css    # 布局与样式
│   └── api/items/
│       ├── route.ts                # 待办列表 API（GET / POST）
│       └── [id]/route.ts           # 待办状态更新（PATCH）
├── lib/
│   ├── extract.ts                  # 网页正文提取（含 SSRF 防护）
│   ├── kimi.ts                     # Kimi 大模型调用
│   └── supabase.ts                 # Supabase 客户端
├── supabase/
│   └── schema.sql                  # 数据库建表脚本
├── 灵感一.md                        # 产品设计文档（理念与完整路线图）
└── .env.local.example              # 环境变量模板
```

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.local.example .env.local
```

编辑 `.env.local`：

```bash
# Kimi（月之暗面）— https://platform.moonshot.cn
KIMI_API_KEY=your_kimi_api_key
KIMI_MODEL=moonshot-v1-8k

# Supabase 项目连接信息（项目控制台 API 设置页）
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

```bash
# 3. 在 Supabase 项目的 SQL 编辑器中执行建表脚本
#    复制 supabase/schema.sql 内容执行

# 4. 启动开发服务器
npm run dev        # http://localhost:3000

# 生产构建
npm run build && npm run start
```

## 🔒 安全说明

- 所有密钥仅通过环境变量注入，仓库中**不含任何真实凭证**
- `lib/extract.ts` 拦截内网 / 回环 / 链路本地 / 云元数据地址，防止公开链接 302 绕过访问内部服务
- 建议参照 `.env.local.example` 配置本地环境，切勿将 `.env.local` 提交到版本库

## 📄 许可证

[MIT License](LICENSE)
