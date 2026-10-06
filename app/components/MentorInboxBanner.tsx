"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function MentorInboxBanner() {
    const router = useRouter();
    const [count, setCount] = useState(0);
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: prof } = await supabase.from("profiles").select("fb_mentor").eq("id", user.id).single();
            if (!(prof as any)?.fb_mentor) return;
            const { count: c } = await supabase.from("fb_requests").select("id", { count: "exact", head: true }).eq("status", "pending").or(`assignee_id.eq.${user.id},and(target.eq.any,assignee_id.is.null)`);
            setCount(c || 0);
        })();
    }, []);
    if (count === 0) return null;
    return (
        <div onClick={() => router.push("/fb/inbox")} style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 9000, cursor: "pointer", padding: "10px 16px", borderRadius: 999, background: "linear-gradient(90deg, rgba(139,92,246,0.95), rgba(167,139,250,0.95))", color: "#fff", fontSize: 13.5, fontWeight: 900, boxShadow: "0 8px 24px rgba(139,92,246,0.5)", whiteSpace: "nowrap" }}>
            💌 FBリクエストが {count} 件届いています →
        </div>
    );
}
