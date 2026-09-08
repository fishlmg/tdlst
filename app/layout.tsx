import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灵感一 · 收藏 → 执行",
  description: "把收藏变成今天能做的事",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
