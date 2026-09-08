import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.warn(
    "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未配置，数据库相关接口会报错。请复制 .env.local.example 为 .env.local 并填入阿里云 Supabase 项目的连接信息。"
  );
}

// 用占位值兜底，避免没配置 .env.local 时在模块加载阶段（含 next build 的静态分析）直接抛错。
// 真正调用数据库接口时才会因为连不上占位地址而报错，错误信息会正常返回给前端。
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  serviceRoleKey || "placeholder-key",
  { auth: { persistSession: false } }
);

export type Item = {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  todo_text: string | null;
  status: "pending" | "done";
  created_at: string;
};
