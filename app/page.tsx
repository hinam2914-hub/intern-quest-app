"use client";
// ルート（/）：ログイン済みなら /home、未ログインなら /login（タイトル画面）へ。
// 以前は開発用のプレースホルダー表示だった。
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";

export default function Page() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => router.replace(session?.user ? "/home" : "/login"))
      .catch(() => router.replace("/login"));
  }, [router]);
  return (
    <main style={{ minHeight: "100vh", background: "#79c0ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontFamily: "system-ui, sans-serif" }}>
      Intern Quest 2.0
    </main>
  );
}
