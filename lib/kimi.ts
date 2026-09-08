import OpenAI from "openai";
import type { ExtractedContent } from "./extract";

// 同样用占位值兜底，避免没配置 .env.local 时在模块加载阶段直接抛错。
const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY || "placeholder-key",
  baseURL: "https://api.moonshot.cn/v1",
});

export type GeneratedTodo = {
  summary: string;
  todo: string;
};

const SYSTEM_PROMPT = `你是一个"收藏→执行力"助手。用户会给你一段从网页/收藏内容中提取的文本（可能只有标题，没有正文）。
你的任务：
1. 用一句话总结这条内容在讲什么（summary）。
2. 从内容里提取一个具体、可执行的 TODO（todo）——不是"了解一下 XX"这种空话，而是"今天/本周可以直接去做的一件事"。
只输出严格的 JSON，格式为 {"summary": "...", "todo": "..."}，不要输出任何其他文字。`;

export async function generateTodo(
  content: ExtractedContent,
  url: string
): Promise<GeneratedTodo> {
  const userContent = content.text
    ? `标题：${content.title}\n链接：${url}\n正文：\n${content.text.slice(0, 6000)}`
    : `标题：${content.title}\n链接：${url}\n（未能提取正文，可能是短视频等无法解析的内容，请仅根据标题合理推测并生成 TODO）`;

  const completion = await client.chat.completions.create({
    model: process.env.KIMI_MODEL || "moonshot-v1-8k",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

  try {
    const parsed = JSON.parse(raw);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      todo: typeof parsed.todo === "string" ? parsed.todo : "",
    };
  } catch {
    console.error("[kimi] 模型未返回合法 JSON，已降级为纯摘要：", raw);
    return { summary: raw, todo: "" };
  }
}
