# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev      # start dev server (Turbopack) at localhost:3000
npm run build    # production build
npm run start    # run the production build
```

No lint or test scripts are configured yet — don't assume `npm test` / `npm run lint` exist.

This project does not use git (deliberate choice by the owner). Don't run `git init` or suggest git workflows unless explicitly asked.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in:
   - `KIMI_API_KEY` — Moonshot AI (Kimi), OpenAI-SDK-compatible, used via `openai` npm package pointed at `https://api.moonshot.cn/v1`
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — an Aliyun-hosted Supabase-compatible project (AnalyticDB/RDS/PolarDB Supabase), not supabase.com
2. Run `supabase/schema.sql` once against that Supabase project's SQL editor (or via the `aliyun-supabase` MCP server, see below). There is no migration tool/ORM — schema changes are hand-written SQL files applied manually.

## Current status (as of 2026-07-10)

- Code is complete and builds clean (`npm run build` passes) for the Phase 0 loop described below.
- `.env.local` is filled in with a real `KIMI_API_KEY` and a real Aliyun Supabase project's `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.
- **`supabase/schema.sql` has been applied.** The pre-existing unrelated `area_occupancy` table (see below) was dropped at the same time — `public` schema now contains only `items`, confirmed empty.
- Full loop has been end-to-end tested against real credentials via the running dev server: POST a URL → `extractContent` → Kimi → row inserted into `items` → GET lists it → PATCH toggles `status`. All confirmed working.
- The Supabase project in use is **not dedicated to this app** — it already contained an unrelated, empty table (`area_occupancy`, columns `id/timestamp/area/is_occupied/created_at/updated_at`, reads like leftover from a room/space-occupancy demo) before this project touched it, and was dropped only after explicit confirmation from the owner (it had 0 rows). If this project's Supabase instance ever gets reused again, don't assume the database starts clean — check what's actually in it before running destructive SQL: `GET {SUPABASE_URL}/rest/v1/` with the service role key returns a PostgREST-generated OpenAPI doc listing every exposed table (and its columns, under `.definitions`), or use the `aliyun-supabase` MCP server's `list_table`.
- During the SSRF-hardening pass below, a code review surfaced and fixed real bugs in `lib/extract.ts` and `lib/kimi.ts` (see "Security/robustness fixes" below) — re-read that section before touching either file.
- Next steps are product-driven from here (WeChat share intake, push notifications, etc. per `docs/product-idea.md`) — the Phase 0 manual-paste loop itself is done and verified.

### Security/robustness fixes applied to the extract/Kimi pipeline

Because `POST /api/items` takes an arbitrary user-supplied URL with no auth layer and fetches it server-side using the Supabase **service role** key downstream, a code review flagged and fixed:

- **SSRF**: `lib/extract.ts` now resolves the hostname (or checks a literal IP) before fetching and rejects loopback/RFC1918/link-local/cloud-metadata ranges (incl. Aliyun's `100.100.100.200`) and non-http(s) schemes. Redirects are followed manually (`redirect: "manual"`, capped at 5 hops) with the same check re-applied on every hop, so a public URL can't 302 its way to an internal target.
- **No fetch timeout** → added `AbortSignal.timeout(15_000)`, so a non-responding remote can't hang a request indefinitely.
- **Unbounded response body** → added a 5MB streaming cap (checks `Content-Length` when present, and also caps while reading chunks since a server can lie about or omit that header).
- **Kimi non-JSON output silently dropping the TODO** → `lib/kimi.ts` now passes `response_format: { type: "json_object" }` to Moonshot to make strict-JSON compliance far more likely, and logs (`console.error`) when the fallback path is hit so a bad Kimi response is at least diagnosable server-side instead of silently producing an item with an empty `todo_text`.

None of this changed the intentional patterns documented elsewhere in this file (env-var placeholder fallbacks, relative imports, async `params` in the `[id]` route, title-only fallback for non-article pages) — those are untouched.

### Dev server gotcha (Windows/Turbopack)

A `next dev` process left running for a long time can get its Turbopack/Jest-worker pool into a broken state where previously-untouched routes 500 with `Jest worker encountered N child process exceptions, exceeding retry limit` on first compile — this is dev-server-internal flakiness, not necessarily a code bug. If a route that should work throws this specific error, kill the dev server process and restart `npm run dev` before assuming the code is wrong.

## MCP

An `aliyun-supabase` MCP server can be registered (verify with `claude mcp get aliyun-supabase`) using the official `@aliyun-supabase/mcp-server-supabase` package, pointed at your own Supabase project, for driving this Supabase project directly from Claude Code.

- The MCP server can be registered at user scope or project scope. At user scope, the credentials it holds are available to every Claude Code project on the machine — register at project scope if you want them isolated to this project.
- Gotcha: **`-s local` scope is broken for MCP servers on this Windows setup.** `claude mcp add -s local` normalizes the current project path to lowercase-with-forward-slashes when writing it (e.g. `d:/project/tdlst`), but `claude mcp get`/`list`/`remove` resolve the current project via `process.cwd()` verbatim (e.g. `D:\project\tdlst`, uppercase drive letter) — the string comparison never matches, so the server is silently unreachable via any lookup command right after being added with `-s local`. Use `-s user` instead until this is fixed upstream.
- A freshly-`add`ed MCP server is **not** available as a callable tool inside an already-running Claude Code session — the session needs to be restarted before its tools can actually be used.
- The first health check after adding a server can show "✘ Failed to connect" even when everything is configured correctly, simply because `npx -y package@latest` needs to download the package on first run, which is slower than the health-check timeout. Retrying `claude mcp get <name>` once npm's cache is warm resolves it.

## Architecture

Single Next.js (App Router, TypeScript) project serving both frontend and backend — no separate API server.

**Core data flow** (the entire product loop): user pastes a URL in `app/page.tsx` → `POST /api/items` (`app/api/items/route.ts`) → `lib/extract.ts` fetches the page and runs `@mozilla/readability` over a `jsdom` DOM to pull article text → `lib/kimi.ts` sends that text to Kimi and gets back strict-JSON `{summary, todo}` → row inserted into the single `items` table in Supabase → list re-rendered client-side. `PATCH /api/items/[id]` toggles an item between `pending`/`done`.

There's no auth layer yet — API routes use the Supabase **service role** key directly server-side; nothing is scoped per-user.

**Known/intentional limitation**: `extractContent` in `lib/extract.ts` only handles article-style pages. Short-video landing pages (Douyin/Xiaohongshu/Bilibili) won't yield extractable text via Readability — this falls back to title-only content going into the Kimi prompt. That's expected MVP behavior, not a bug to "fix" by adding a scraper (see compliance note below).

### Non-obvious gotchas (hit during initial setup, don't reintroduce)

- **TypeScript must stay on the 5.x line** (`devDependencies` pins `^5.9.3`). TypeScript 7.x is the experimental Go-native rewrite and silently breaks Next.js's internal type-checking worker with an unrelated-looking `"id" argument must be of type string` crash during `next build`.
- **`package.json` must keep `"type": "module"`**. The app directory uses ESM import/export throughout; switching this back to `"commonjs"` breaks the Turbopack build across every route.
- Internal imports use **relative paths, not the `@/` alias** — the `@/*` path in `tsconfig.json` is configured but does not reliably resolve under the current Next/Turbopack setup on this machine (webpack build silently produced "Module not found"). Keep using relative imports (`../../../lib/...`) inside `app/api/**` until this is revisited.
- `lib/supabase.ts` and `lib/kimi.ts` construct their clients with **placeholder fallback values** (`process.env.X || "placeholder-..."`) instead of throwing when env vars are missing. Both the Supabase JS client and the OpenAI SDK throw *at construction time* (i.e. at module load, which runs during `next build`'s page-data collection) if given an empty string/undefined — without the fallback, a missing `.env.local` breaks the entire production build rather than failing gracefully at request time. Preserve this pattern if these clients are refactored.
- `app/api/items/[id]/route.ts` uses the Next 15+ async dynamic API route signature: `{ params }: { params: Promise<{ id: string }> }`, requiring `await params`.

## Product context

`docs/product-idea.md` (Chinese; previously `灵感一.md`) is the product/strategy doc — market analysis, phased roadmap, and business model for the broader vision ("turn scattered social-media bookmarks into daily actionable TODOs"). The current code is Phase 0 of that roadmap: manual link paste only.

Important constraint from that doc: **do not build cookie/signature-reverse-engineering scrapers for Douyin/Xiaohongshu** (e.g. ABogus/x-s/x-t signing). There is real precedent of civil (unfair-competition, ¥4.9M damages) and criminal liability in China for exactly this pattern at commercial scale. The planned collection paths for platforms without an official OAuth API are: user-initiated share/forward (e.g. to a WeChat official account) or manual paste — never automated background scraping. Bilibili is the exception *if* an OAuth app gets approved (unconfirmed — Bilibili's open platform appears geared toward institutional/MCN accounts, not confirmed to support individual developers or a favorites-read scope); until confirmed, treat Bilibili the same as Douyin/Xiaohongshu (share/paste only).

Target deployment is Aliyun (not Vercel) for mainland China network accessibility, with WeChat official account template messages as the push-notification channel (standard Web Push via FCM is unreliable on mainland Android).
