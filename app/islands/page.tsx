"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import IslandScene, { IslandSceneStyle } from "../components/IslandScene";
import { STEP_TITLE, getLevel, avatarIdOf } from "../lib/island";

type Island = {
    id: string;
    name: string;
    streak: number;
    avatarId: string;
    level: number;
    stepNo: number;
    totalEarned: number;
    config: Record<string, string>;
    licenses: Record<string, boolean>;
};

function titleBadges(i: Island): string[] {
    const t: string[] = [];
    if (i.stepNo >= 6) t.push("⚔️ 営業デビュー");
    if (i.streak >= 30) t.push("🔥 30日連続");
    else if (i.streak >= 7) t.push("🔥 " + i.streak + "日連続");
    if (i.level >= 20) t.push("⭐ トップランカー");
    else if (i.level >= 10) t.push("💎 努力家");
    if (t.length === 0) t.push("🌱 かけだし冒険者");
    return t.slice(0, 2);
}

const OFFSETS = [0, 30, 14];

export default function IslandsPage() {
    const router = useRouter();
    const [islands, setIslands] = useState<Island[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState<"osusume" | "level" | "streak">("osusume");
    const [departing, setDeparting] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const [{ data: profiles }, { data: points }, { data: jsubs }] = await Promise.all([
                supabase.from("profiles").select("id, name, streak, avatar_config, island_config, licenses").eq("is_active", true),
                supabase.from("user_points").select("id, total_earned"),
                supabase.from("journey_submissions").select("user_id, step_no, status").eq("status", "approved"),
            ]);
            const ptMap: Record<string, number> = {};
            (points || []).forEach((p: any) => { ptMap[p.id] = p.total_earned || 0; });
            const stepMap: Record<string, number> = {};
            (jsubs || []).forEach((s: any) => { stepMap[s.user_id] = Math.max(stepMap[s.user_id] || 0, s.step_no); });
            const list: Island[] = (profiles || []).map((p: any) => {
                const avatarId = avatarIdOf(p.avatar_config);
                const te = ptMap[p.id] || 0;
                return {
                    id: p.id,
                    name: p.name || "名無し",
                    streak: p.streak || 0,
                    avatarId,
                    level: getLevel(te),
                    stepNo: stepMap[p.id] || 0,
                    totalEarned: te,
                    config: (p.island_config || {}) as Record<string, string>,
                    licenses: (p.licenses || {}) as Record<string, boolean>,
                };
            });
            setIslands(list);
            setLoading(false);
        };
        load();
    }, [router]);

    const stars = useMemo(() => Array.from({ length: 64 }, (_, i) => ({
        left: (i * 137) % 100,
        top: (i * 61) % 92,
        size: 1 + (i % 3),
        delay: (i % 40) / 10,
        dur: 2 + (i % 4),
    })), []);

    const filtered = islands
        .filter((i) => i.name.includes(search))
        .sort((a, b) => tab === "osusume" ? b.stepNo - a.stepNo || b.level - a.level : tab === "level" ? b.level - a.level : b.streak - a.streak);

    const visit = (id: string) => {
        if (departing) return;
        setDeparting(id);
        setTimeout(() => router.push("/profile/" + id), 420);
    };
    const randomVisit = () => {
        if (!filtered.length || departing) return;
        visit(filtered[Math.floor(Math.random() * filtered.length)].id);
    };

    const tabChip = (label: string, key: typeof tab) => (
        <button onClick={() => setTab(key)} style={{ padding: "8px 16px", borderRadius: 999, border: tab === key ? "1px solid rgba(167,139,250,.65)" : "1px solid rgba(255,255,255,.1)", cursor: "pointer", background: tab === key ? "rgba(139,92,246,.28)" : "rgba(255,255,255,.03)", color: tab === key ? "#e5e0ff" : "#8b8fa8", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</button>
    );

    return (
        <div style={{ minHeight: "100vh", background: "#0b0b14", padding: "24px 16px 90px", position: "relative", overflow: "hidden" }}>
            <IslandSceneStyle />
            <style>{`
                @keyframes iqTwinkle { 0%,100%{opacity:.12} 50%{opacity:.9} }
                @keyframes iqBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
                @keyframes iqShoot { 0%{transform:translate(0,0) rotate(-32deg);opacity:0} 4%{opacity:1} 22%{transform:translate(-360px,230px) rotate(-32deg);opacity:0} 100%{transform:translate(-360px,230px) rotate(-32deg);opacity:0} }
                @keyframes iqAurora { 0%,100%{transform:translateX(-5%) skewX(-6deg);opacity:.45} 50%{transform:translateX(5%) skewX(5deg);opacity:.75} }
                @keyframes iqShip { 0%{transform:translateX(-160px)} 100%{transform:translateX(110vw)} }
                @keyframes iqFar { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
                @keyframes iqCloud { 0%{transform:translateX(-120px)} 100%{transform:translateX(110vw)} }
                .iq-isle { position:relative; cursor:pointer; transition: transform .35s ease, filter .35s ease, opacity .4s ease; }
                .iq-isle:hover { transform: translateY(-8px); filter: drop-shadow(0 0 26px rgba(139,92,246,.55)); z-index: 5; }
                .iq-isle:hover .iq-window { opacity: 1 !important; }
                .iq-visit-btn { opacity:0; transform: translateY(8px); transition: all .28s ease; pointer-events:none; }
                .iq-isle:hover .iq-visit-btn { opacity:1; transform: translateY(0); }
                @media (hover: none) { .iq-visit-btn { opacity:1; transform:none; } }
                .iq-glow { position:absolute; inset:-14px; border-radius:36px; background: radial-gradient(circle at 50% 34%, rgba(167,139,250,.28), transparent 65%); opacity:0; transition: opacity .3s; pointer-events:none; }
                .iq-isle:hover .iq-glow { opacity:1; }
                .iq-spark { position:absolute; font-size:12px; color:#fbbf24; opacity:0; pointer-events:none; z-index:6; }
                .iq-isle:hover .iq-spark { animation: iqTwinkle 1s ease-in-out infinite; }
                .iq-departing { transform: scale(1.55) translateY(-14px) !important; opacity:0 !important; z-index:50; }
                .iq-dim { opacity:.08; pointer-events:none; }
            `}</style>

            {/* 背景：星空 */}
            <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
                {stars.map((s, idx) => (
                    <div key={idx} style={{ position: "absolute", left: s.left + "%", top: s.top + "%", width: s.size, height: s.size, borderRadius: "50%", background: "#fff", animation: `iqTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
                ))}
                {/* 月 */}
                <div style={{ position: "absolute", top: "5%", right: "7%", width: 58, height: 58, borderRadius: "50%", background: "radial-gradient(circle at 60% 40%, #fdf6d8, #e8dca0)", boxShadow: "0 0 40px rgba(253,246,216,.35)" }}>
                    <div style={{ position: "absolute", top: 13, left: 11, width: 11, height: 11, borderRadius: "50%", background: "rgba(200,190,150,.5)" }} />
                    <div style={{ position: "absolute", top: 32, left: 28, width: 7, height: 7, borderRadius: "50%", background: "rgba(200,190,150,.4)" }} />
                </div>
                <div style={{ position: "absolute", top: "-8%", left: "-10%", width: "70%", height: "45%", background: "radial-gradient(ellipse, rgba(139,92,246,.22), transparent 65%)", filter: "blur(40px)", animation: "iqAurora 11s ease-in-out infinite" }} />
                <div style={{ position: "absolute", top: "10%", right: "-14%", width: "60%", height: "40%", background: "radial-gradient(ellipse, rgba(99,102,241,.18), transparent 65%)", filter: "blur(46px)", animation: "iqAurora 14s ease-in-out 2s infinite" }} />
                <div style={{ position: "absolute", top: "6%", right: "20%", width: 3, height: 90, background: "linear-gradient(180deg, #fff, transparent)", animation: "iqShoot 9s linear 2s infinite" }} />
                <div style={{ position: "absolute", top: "2%", left: "62%", width: 2, height: 70, background: "linear-gradient(180deg, #fff, transparent)", animation: "iqShoot 13s linear 6s infinite" }} />
                <div style={{ position: "absolute", top: "14%", width: 130, height: 34, borderRadius: 999, background: "rgba(255,255,255,.05)", filter: "blur(10px)", animation: "iqCloud 60s linear infinite" }} />
                <div style={{ position: "absolute", top: "34%", width: 170, height: 40, borderRadius: 999, background: "rgba(255,255,255,.04)", filter: "blur(12px)", animation: "iqCloud 85s linear 20s infinite" }} />
                {[{ t: "16%", l: "6%", w: 54, d: "0s" }, { t: "30%", r: "5%", w: 44, d: "2.5s" }, { t: "64%", l: "3%", w: 38, d: "1.2s" }].map((f: any, idx) => (
                    <div key={idx} style={{ position: "absolute", top: f.t, left: f.l, right: f.r, width: f.w, opacity: .32, filter: "blur(.5px)", animation: `iqFar 8s ease-in-out ${f.d} infinite` }}>
                        <div style={{ width: "100%", height: f.w * .34, borderRadius: "50%", background: "#3b325e" }} />
                        <div style={{ width: 0, height: 0, margin: "0 auto", borderLeft: f.w * .32 + "px solid transparent", borderRight: f.w * .32 + "px solid transparent", borderTop: f.w * .5 + "px solid #2a2347" }} />
                    </div>
                ))}
                {/* 飛行船 */}
                <div style={{ position: "absolute", top: "1.5%", opacity: .5, animation: "iqShip 55s linear infinite" }}>
                    <div style={{ width: 64, height: 26, borderRadius: 999, background: "linear-gradient(180deg, #8b5cf6, #6d4bc4)", boxShadow: "0 0 14px rgba(139,92,246,.4)" }} />
                    <div style={{ width: 22, height: 9, margin: "5px auto 0", borderRadius: 3, background: "#4a3a6a" }} />
                </div>
            </div>

            <div style={{ maxWidth: 980, margin: "0 auto", position: "relative" }}>
                <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer" }} onClick={() => router.push("/home")}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: "8px 0 6px", textShadow: "0 0 24px rgba(139,92,246,.5)" }}>🌴 みんなの島へ行く</h1>
                <p style={{ fontSize: 13, color: "#a5a8c0", margin: "0 0 20px", lineHeight: 1.7 }}>仲間の島を訪問して、家の成長や冒険の進み具合を見てみよう！</p>

                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 インターンを検索" style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(167,139,250,.3)", background: "rgba(255,255,255,.04)", color: "#fff", fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" }} />

                <div style={{ display: "flex", gap: 8, marginBottom: 34, flexWrap: "wrap" }}>
                    {tabChip("🌍 おすすめの島", "osusume")}
                    {tabChip("⭐ レベル順", "level")}
                    {tabChip("🔥 連続記録順", "streak")}
                    <button onClick={randomVisit} style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid rgba(251,191,36,.45)", cursor: "pointer", background: "rgba(251,191,36,.12)", color: "#fbbf24", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>🎲 ランダム訪問</button>
                </div>

                {loading ? (
                    <div style={{ color: "#8b8fa8", padding: 40, textAlign: "center" }}>島を探しています...</div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "46px 24px" }}>
                        {filtered.map((i, idx) => (
                            <div key={i.id} style={{ transform: `translateY(${OFFSETS[idx % 3]}px)` }}>
                                <div className={"iq-isle" + (departing === i.id ? " iq-departing" : departing ? " iq-dim" : "")} onClick={() => visit(i.id)}>
                                    <div className="iq-glow" />
                                    <span className="iq-spark" style={{ top: 8, left: "16%" }}>✦</span>
                                    <span className="iq-spark" style={{ top: 34, right: "12%" }}>✦</span>
                                    <div style={{ animation: `iqBob ${4.6 + (idx % 4) * .5}s ease-in-out ${(idx % 5) * .4}s infinite` }}>
                                        <IslandScene variant="card" totalEarned={i.totalEarned} avatarId={i.avatarId} name={i.name} config={i.config} seed={idx} />
                                    </div>
                                    {/* 情報パネル（島から離して浮遊感） */}
                                    <div style={{ marginTop: 40, textAlign: "center", padding: "13px 10px 13px", borderRadius: 18, background: "rgba(30,25,55,.5)", border: "1px solid rgba(139,92,246,.2)", backdropFilter: "blur(6px)" }}>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb" }}>{i.name}</div>
                                        {(i.licenses.ip || i.licenses.cb || i.licenses.sales) && (
                                            <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 6 }}>
                                                {i.licenses.ip && <img src="/island/licenses/license_ip.png" alt="IP" style={{ width: 24, height: 24 }} />}
                                                {i.licenses.cb && <img src="/island/licenses/license_cb.png" alt="CB" style={{ width: 24, height: 24 }} />}
                                                {i.licenses.sales && <img src="/island/licenses/license_sales.png" alt="営業昇格" style={{ width: 24, height: 24 }} />}
                                            </div>
                                        )}
                                        <div style={{ marginTop: 6 }}>
                                            <span style={{ fontSize: 12, fontWeight: 900, color: "#fbbf24", background: "rgba(251,191,36,.13)", border: "1px solid rgba(251,191,36,.35)", padding: "3px 12px", borderRadius: 999 }}>Lv.{i.level}</span>
                                        </div>
                                        <div style={{ fontSize: 10.5, color: "#c4b5fd", marginTop: 7, fontWeight: 700 }}>{i.stepNo >= 6 ? "🏆 営業デビュー" : "STEP" + i.stepNo + " " + (STEP_TITLE[i.stepNo] || "")}</div>
                                        <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 6 }}>
                                            {[1, 2, 3, 4, 5, 6].map((n) => (
                                                <span key={n} style={{ width: 8, height: 8, borderRadius: "50%", background: n <= i.stepNo ? "#a78bfa" : "rgba(255,255,255,.14)", boxShadow: n === i.stepNo && i.stepNo > 0 ? "0 0 8px #a78bfa" : "none" }} />
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
                                            {i.streak > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "#fb923c", background: "rgba(251,146,60,.1)", border: "1px solid rgba(251,146,60,.28)", padding: "2px 8px", borderRadius: 999 }}>🔥 {i.streak}日</span>}
                                            {titleBadges(i).map((t, bi) => (
                                                <span key={bi} style={{ fontSize: 10, fontWeight: 800, color: "#ddd6fe", background: "rgba(139,92,246,.14)", border: "1px solid rgba(167,139,250,.26)", padding: "2px 8px", borderRadius: 999 }}>{t}</span>
                                            ))}
                                        </div>
                                        <div className="iq-visit-btn" style={{ marginTop: 11 }}>
                                            <span style={{ display: "inline-block", padding: "9px 24px", borderRadius: 999, background: "linear-gradient(135deg, #8b5cf6, #6d4bc4)", color: "#fff", fontSize: 13, fontWeight: 900, boxShadow: "0 5px 18px rgba(139,92,246,.55)" }}>▶ 島へ遊びに行く</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
