"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  todo_text: string | null;
  status: "pending" | "done";
  created_at: string;
};

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/items");
    const data = await res.json();
    if (res.ok) setItems(data.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "添加失败");
        return;
      }
      setUrl("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function toggle(item: Item) {
    const nextStatus = item.status === "pending" ? "done" : "pending";
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i))
    );
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  return (
    <main>
      <h1>灵感一</h1>
      <p className="subtitle">把收藏变成今天能做的事</p>

      <form onSubmit={handleSubmit}>
        <input
          type="url"
          placeholder="粘贴任意链接..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "AI 处理中..." : "添加"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {items.length === 0 && !error && (
        <p className="empty">还没有收藏，粘贴一个链接试试。</p>
      )}

      {items.map((item) => (
        <div key={item.id} className={`item ${item.status === "done" ? "done" : ""}`}>
          <input
            type="checkbox"
            checked={item.status === "done"}
            onChange={() => toggle(item)}
          />
          <div className="item-body">
            <div className="item-title">{item.title || item.url}</div>
            {item.todo_text && <div className="item-todo">☑ {item.todo_text}</div>}
            {item.summary && <div className="item-summary">{item.summary}</div>}
            <a className="item-link" href={item.url} target="_blank" rel="noreferrer">
              {item.url}
            </a>
          </div>
        </div>
      ))}
    </main>
  );
}
