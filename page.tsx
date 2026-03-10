"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onLogin = async () => {
    try {
      setMsg("logging in...");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("login result", data, error);

      if (error) throw error;

      router.push("/mypage");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "login failed");
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Login</h1>

      <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={onLogin}>Login</button>

        <pre>{msg}</pre>
      </div>
    </main>
  );
}