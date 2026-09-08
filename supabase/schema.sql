-- 在阿里云 Supabase 项目的 SQL 编辑器里执行一次即可
create extension if not exists pgcrypto;

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text,
  summary text,
  todo_text text,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now()
);
