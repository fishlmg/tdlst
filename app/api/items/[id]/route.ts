import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;

  if (status !== "pending" && status !== "done") {
    return NextResponse.json({ error: "status 只能是 pending 或 done" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("items")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
