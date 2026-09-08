import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ExtractedContent = {
  title: string;
  text: string;
};

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB，防止单个链接把内存吃满

// 拦截内网/本地/云元数据地址，防止 SSRF（用户可以粘贴任意链接，服务端会直接 fetch）
function isPrivateOrReservedIp(ip: string, family: number): boolean {
  if (family === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local，含云厂商元数据地址 169.254.169.254
    if (a === 100 && b >= 64 && b <= 127) return true; // 共享地址空间，含阿里云元数据 100.100.100.200
    if (a === 0) return true;
    return false;
  }
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // link-local fe80::/10
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.split(":").pop()!;
    if (isIP(v4) === 4) return isPrivateOrReservedIp(v4, 4);
  }
  return false;
}

async function assertUrlIsAllowed(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("链接格式不正确");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("只支持 http/https 链接");
  }

  const hostname = parsed.hostname;
  const directFamily = isIP(hostname);
  if (directFamily) {
    if (isPrivateOrReservedIp(hostname, directFamily)) {
      throw new Error("该链接不允许访问");
    }
    return parsed;
  }

  const records = await lookup(hostname, { all: true });
  if (records.length === 0) {
    throw new Error("无法解析该链接");
  }
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address, record.family)) {
      throw new Error("该链接不允许访问");
    }
  }
  return parsed;
}

async function readBodyWithLimit(res: Response): Promise<string> {
  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new Error("页面内容过大");
  }
  if (!res.body) return res.text();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("页面内容过大");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
}

/**
 * 用 JS 原生方案（jsdom + Readability）代替 Python 的 trafilatura。
 * 图文/网页类内容能拿到正文；短视频落地页大概率拿不到正文，
 * 这里退化为只用 <title> 兜底，AI 就只能靠标题生成 TODO —— 这是已知的 MVP 限制，不是 bug。
 */
export async function extractContent(url: string): Promise<ExtractedContent> {
  let currentUrl = url;
  let res: Response | undefined;

  // 每一跳都重新校验目标地址，防止跳转到内网地址绕过检查
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validated = await assertUrlIsAllowed(currentUrl);
    res = await fetch(validated, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      currentUrl = new URL(location, validated).toString();
      continue;
    }
    break;
  }

  if (!res) {
    throw new Error("抓取失败");
  }
  if (!res.ok) {
    throw new Error(`抓取失败：${res.status} ${res.statusText}`);
  }

  const html = await readBodyWithLimit(res);
  const dom = new JSDOM(html, { url: res.url || currentUrl });
  const article = new Readability(dom.window.document).parse();

  if (article?.textContent?.trim()) {
    return {
      title: article.title || dom.window.document.title || url,
      text: article.textContent.trim(),
    };
  }

  // Readability 抽不出正文（常见于短视频落地页），只用标题兜底
  return {
    title: dom.window.document.title || url,
    text: "",
  };
}
