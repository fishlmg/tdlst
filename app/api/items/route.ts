import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { extractContent } from "../../../lib/extract";
import { generateTodo } from "../../../lib/kimi";

export async function GET() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const url = body?.url?.trim();

  if (!url) {
    return NextResponse.json({ error: "缺少链接" }, { status: 400 });
  }

  try {
    const content = await extractContent(url);
    const { summary, todo } = await generateTodo(content, url);

    const { data, error } = await supabase
      .from("items")
      .insert({
        url,
        title: content.title,
        summary,
        todo_text: todo,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "处理失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
