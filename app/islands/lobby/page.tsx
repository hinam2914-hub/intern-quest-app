"use client";
// みんなの島ロビー（新画面）。旧 /islands は動作確認が終わるまで残す
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getLevel, avatarIdOf } from "../../lib/island";
import LobbyView from "./LobbyView";
import type { LobbyDept, LobbyIsland } from "./lobby-layout";

export default function LobbyPage() {
    const router = useRouter();
    const [data, setData] = useState<{ islands: LobbyIsland[]; depts: LobbyDept[]; meId: string | null; initial: string | null } | null>(null);
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const [{ data: profiles }, { data: points }, { data: jsubs }, { data: depts }] = await Promise.all([
                supabase.from("profiles").select("id, name, streak, avatar_config, island_config, licenses, department_id").eq("is_active", true),
                supabase.from("user_points").select("id, total_earned"),
                supabase.from("journey_submissions").select("user_id, step_no, status").eq("status", "approved"),
                supabase.from("departments").select("*"),
            ]);
            const ptMap: Record<string, number> = {}; (points || []).forEach((p: any) => { ptMap[p.id] = p.total_earned || 0; });
            const stepMap: Record<string, number> = {}; (jsubs || []).forEach((s: any) => { stepMap[s.user_id] = Math.max(stepMap[s.user_id] || 0, s.step_no); });
            const islands: LobbyIsland[] = (profiles || []).map((p: any) => { const te = ptMap[p.id] || 0; return { id: p.id, name: p.name || "名無し", streak: p.streak || 0, avatarId: avatarIdOf(p.avatar_config), level: getLevel(te), stepNo: stepMap[p.id] || 0, totalEarned: te, config: (p.island_config || {}) as Record<string, string>, licenses: (p.licenses || {}) as Record<string, boolean>, deptId: p.department_id || null }; });
            const sp = new URLSearchParams(window.location.search);
            setData({ islands, depts: ((depts || []) as any[]).map((d) => ({ id: d.id, name: d.name, code: d.code, color: d.color, sort_order: d.sort_order ?? null })), meId: user.id, initial: sp.get("u") });
        })();
    }, [router]);
    if (!data) return <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#9fd3ff,#e6f5ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e3a5f", fontWeight: 800 }}>島を探しています...</div>;
    return <LobbyView islands={data.islands} depts={data.depts} meId={data.meId} initialUserId={data.initial} />;
}
