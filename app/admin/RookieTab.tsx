"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type User = { id: string; name: string; department_id: string | null };
type Dept = { id: string; code: string };
type RookieItem = { id: string; block: string; title: string; order_no: number };
type Sub = { id: string; user_id: string; challenge_id: string; comment: string | null; image_url: string | null; created_at: string };

const BLOCK_ORDER = ["①コミュ基礎", "②研修・同行", "③初稼働まで", "④人間力"];
// 営業研修に進む条件：①②が完了していること
const GATE_BLOCKS = ["①コミュ基礎", "②研修・同行"];

export default function RookieTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Dept[]>([]);
    const [items, setItems] = useState<RookieItem[]>([]);
    const [subs, setSubs] = useState<Sub[]>([]);
    const [loading, setLoading] = useState(true);
    const [deptFilter, setDeptFilter] = useState("all");
    const [openUser, setOpenUser] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: userRows } = await supabase.from("profiles").select("id, name, department_id").eq("is_active", true).order("name");
            const { data: deptRows } = await supabase.from("departments").select("id, code");
            setUsers((userRows || []) as User[]);
            setDepartments((deptRows || []) as Dept[]);
            const { data: itemRows } = await supabase.from("rookie_challenges").select("id, block, title, order_no").eq("is_active", true).order("order_no");
            const { data: subRows } = await supabase.from("rookie_submissions").select("*").eq("status", "approved");
            setItems((itemRows || []) as RookieItem[]);
            setSubs((subRows || []) as Sub[]);
            setLoading(false);
        };
        load();
    }, []);

    const deptCode: Record<string, string> = {};
    departments.forEach(d => { deptCode[d.id] = d.code; });

    // ブロックごとの項目数
    const blockTotals: Record<string, number> = {};
    items.forEach(i => { blockTotals[i.block] = (blockTotals[i.block] || 0) + 1; });
    const totalItems = items.length;

    // ユーザーごとの達成数・ブロック別達成数
    const userStats = (uid: string) => {
        const mySubs = subs.filter(s => s.user_id === uid);
        const doneIds = new Set(mySubs.map(s => s.challenge_id));
        const byBlock: Record<string, number> = {};
        items.forEach(i => {
            if (doneIds.has(i.id)) byBlock[i.block] = (byBlock[i.block] || 0) + 1;
        });
        const total = mySubs.length;
        // ゲート判定：①②が全項目完了しているか
        const gateOk = GATE_BLOCKS.every(b => (byBlock[b] || 0) >= (blockTotals[b] || 0) && (blockTotals[b] || 0) > 0);
        return { total, byBlock, gateOk, doneIds };
    };

    const filtered = users.filter(u => {
        if (deptFilter === "all") return true;
        if (deptFilter === "none") return !u.department_id;
        return deptCode[u.department_id || ""] === deptFilter;
    });

    // 進捗が高い順にソート
    const sorted = [...filtered].sort((a, b) => userStats(b.id).total - userStats(a.id).total);

    if (loading) return <div style={{ padding: 40, color: "#8b8fa8" }}>集計中...</div>;

    return (
        <div style={{ padding: "8px 0" }}>
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb", margin: "0 0 4px" }}>🏅 一人前チャレンジ 進捗</h2>
                <p style={{ fontSize: 13, color: "#8b8fa8", margin: 0 }}>①②が完了したメンバーは営業研修へ進めます（全{totalItems}項目）</p>
            </div>

            {/* 部署フィルタ */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {["all", ...departments.map(d => d.code), "none"].map(code => (
                    <button key={code} onClick={() => setDeptFilter(code)}
                        style={{
                            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                            background: deptFilter === code ? "rgba(139,92,246,.25)" : "rgba(255,255,255,.04)",
                            border: `1px solid ${deptFilter === code ? "#8b5cf6" : "rgba(255,255,255,.1)"}`,
                            color: deptFilter === code ? "#c4b5fd" : "#9ca3af",
                        }}>
                        {code === "all" ? "全員" : code === "none" ? "未配属" : code}
                    </button>
                ))}
            </div>

            {/* メンバー一覧 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sorted.map(u => {
                    const st = userStats(u.id);
                    const pct = totalItems ? Math.round((st.total / totalItems) * 100) : 0;
                    const isOpen = openUser === u.id;
                    return (
                        <div key={u.id} style={{ borderRadius: 12, background: "rgba(18,18,36,.7)", border: `1px solid ${st.gateOk ? "rgba(52,211,153,.4)" : "rgba(255,255,255,.08)"}`, overflow: "hidden" }}>
                            <div onClick={() => setOpenUser(isOpen ? null : u.id)} style={{ cursor: "pointer", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb" }}>{u.name}</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "#8b8fa8" }}>{deptCode[u.department_id || ""] || "未配属"}</span>
                                        {st.gateOk && <span style={{ fontSize: 10, fontWeight: 900, color: "#34d399", background: "rgba(52,211,153,.15)", border: "1px solid rgba(52,211,153,.4)", borderRadius: 6, padding: "2px 8px" }}>✅ 営業研修OK</span>}
                                    </div>
                                    {/* ブロック別ミニ進捗 */}
                                    <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                                        {BLOCK_ORDER.map(b => {
                                            const done = st.byBlock[b] || 0;
                                            const tot = blockTotals[b] || 0;
                                            const full = tot > 0 && done >= tot;
                                            return (
                                                <span key={b} style={{ fontSize: 10.5, color: full ? "#34d399" : "#9ca3af" }}>
                                                    {b.charAt(0)} {done}/{tot}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right", minWidth: 90 }}>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: pct >= 80 ? "#34d399" : pct >= 40 ? "#a78bfa" : "#9ca3af" }}>{st.total}/{totalItems}</div>
                                    <div style={{ width: 90, height: 5, borderRadius: 999, background: "rgba(255,255,255,.08)", marginTop: 3 }}>
                                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "linear-gradient(90deg,#8b5cf6,#a78bfa)" }} />
                                    </div>
                                </div>
                            </div>

                            {/* 展開：達成項目のエピソード・写真 */}
                            {isOpen && (
                                <div style={{ padding: "0 16px 14px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
                                    {BLOCK_ORDER.map(b => {
                                        const blockItems = items.filter(i => i.block === b).sort((x, y) => x.order_no - y.order_no);
                                        return (
                                            <div key={b} style={{ marginTop: 12 }}>
                                                <div style={{ fontSize: 11, fontWeight: 800, color: "#c4b5fd", marginBottom: 6 }}>{b}</div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    {blockItems.map(it => {
                                                        const sub = subs.find(s => s.user_id === u.id && s.challenge_id === it.id);
                                                        const done = !!sub;
                                                        return (
                                                            <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, padding: "4px 0" }}>
                                                                <span style={{ color: done ? "#34d399" : "#4b5563", flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                                                                <div style={{ flex: 1 }}>
                                                                    <span style={{ color: done ? "#e5e7eb" : "#6b7280" }}>{it.title}</span>
                                                                    {sub?.comment && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>💬 {sub.comment}</div>}
                                                                    {sub?.image_url && <a href={sub.image_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#60a5fa", textDecoration: "underline", marginTop: 2, display: "inline-block" }}>📸 写真を見る</a>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                {sorted.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>該当するメンバーがいません</div>}
            </div>
        </div>
    );
}
