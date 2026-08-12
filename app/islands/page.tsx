"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Island = {
    id: string;
    name: string;
    streak: number;
    avatarId: string;
    level: number;
    stepNo: number;
};

const STEP_TITLE: Record<number, string> = { 0: "冒険の始まり", 1: "入社・研修", 2: "登竜門", 3: "プレイヤー昇格", 4: "DRMスタート", 5: "キャリア面談", 6: "営業デビュー" };

export default function IslandsPage() {
    const router = useRouter();
    const [islands, setIslands] = useState<Island[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<"step" | "level" | "streak">("step");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const [{ data: profiles }, { data: points }, { data: jsubs }] = await Promise.all([
                supabase.from("profiles").select("id, name, streak, avatar_config").eq("is_active", true),
                supabase.from("user_points").select("id, total_earned"),
                supabase.from("journey_submissions").select("user_id, step_no, status").eq("status", "approved"),
            ]);
            const ptMap: Record<string, number> = {};
            (points || []).forEach((p: any) => { ptMap[p.id] = p.total_earned || 0; });
            const stepMap: Record<string, number> = {};
            (jsubs || []).forEach((s: any) => { stepMap[s.user_id] = Math.max(stepMap[s.user_id] || 0, s.step_no); });
            const list: Island[] = (profiles || []).map((p: any) => {
                const cfg = p.avatar_config;
                const avatarId = (cfg && cfg.id) ? cfg.id : "girl_bob_brown";
                const te = ptMap[p.id] || 0;
                return {
                    id: p.id,
                    name: p.name || "名無し",
                    streak: p.streak || 0,
                    avatarId,
                    level: Math.floor(te / 100) + 1,
                    stepNo: stepMap[p.id] || 0,
                };
            });
            setIslands(list);
            setLoading(false);
        };
        load();
    }, [router]);

    const filtered = islands
        .filter((i) => i.name.includes(search))
        .sort((a, b) => sortKey === "step" ? b.stepNo - a.stepNo : sortKey === "level" ? b.level - a.level : b.streak - a.streak);

    const sortChip = (label: string, key: typeof sortKey) => (
        <button onClick={() => setSortKey(key)} style={{ padding: "7px 16px", borderRadius: 999, border: sortKey === key ? "1px solid rgba(167,139,250,.6)" : "1px solid rgba(255,255,255,.1)", cursor: "pointer", background: sortKey === key ? "rgba(139,92,246,.25)" : "rgba(255,255,255,.03)", color: sortKey === key ? "#e5e0ff" : "#8b8fa8", fontSize: 12.5, fontWeight: 800 }}>{label}</button>
    );

    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 20%, #1a1533 0%, #0b0b14 70%)", padding: "24px 16px 80px" }}>
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
                <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer" }} onClick={() => router.push("/home")}>INTERN QUEST</div>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", margin: "6px 0 4px" }}>🏝️ みんなの島へ行く</h1>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px" }}>仲間の島を訪問して、成長や頑張りを見つけよう！</p>

                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 インターンを検索" style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(167,139,250,.3)", background: "rgba(255,255,255,.04)", color: "#fff", fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" }} />

                <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
                    {sortChip("進捗順", "step")}
                    {sortChip("レベル順", "level")}
                    {sortChip("連続記録順", "streak")}
                </div>

                {loading ? (
                    <div style={{ color: "#8b8fa8", padding: 40, textAlign: "center" }}>島を探しています...</div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
                        {filtered.map((i) => (
                            <div key={i.id} onClick={() => router.push("/profile/" + i.id)} style={{ cursor: "pointer", padding: "18px 14px 16px", borderRadius: 22, textAlign: "center", background: "linear-gradient(165deg, rgba(46,38,82,.85), rgba(20,17,40,.85))", border: "1px solid rgba(139,92,246,.25)", boxShadow: "0 6px 22px rgba(0,0,0,.3)", position: "relative" }}>
                                <div style={{ position: "absolute", top: 10, left: 12, fontSize: 11, fontWeight: 900, color: "#fbbf24", background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.3)", padding: "2px 8px", borderRadius: 999 }}>Lv.{i.level}</div>
                                <div style={{ width: 90, height: 90, margin: "8px auto 8px", borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,.2), rgba(167,139,250,.05))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={"/avatars/" + i.avatarId + ".png"} alt={i.name} style={{ width: 80, height: 80, objectFit: "contain" }} />
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb" }}>{i.name}</div>
                                <div style={{ fontSize: 11, color: "#c4b5fd", marginTop: 3, fontWeight: 700 }}>{i.stepNo >= 6 ? "🏆 営業デビュー" : "STEP" + i.stepNo + " " + (STEP_TITLE[i.stepNo] || "")}</div>
                                {i.streak > 0 && <div style={{ fontSize: 11, color: "#fb923c", marginTop: 4, fontWeight: 700 }}>🔥 {i.streak}日連続</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
