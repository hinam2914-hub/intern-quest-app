"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/* ============================================================================
   必修コンテンツ 対象指定 ＋ 完了チェック（管理者用）
   - コンテンツごとに宿題の対象メンバーを個別指定（content_targets）
   - 対象未設定のコンテンツは「全員対象」として扱います
   - 完了 / 承認待ち / 未提出 を対象者のみで集計
   配置先: app/admin/RequiredCheckTab.tsx
============================================================================ */

type Content = {
    id: string;
    title: string;
    category?: string | null;
    is_required?: boolean;
    deadline?: string | null;
    is_active?: boolean | null;
};

type Profile = { id: string; name: string; department_id?: string | null };
type Completion = { content_id: string; user_id: string; status: string | null };
type Target = { content_id: string; user_id: string };

const CLR = {
    bg: "rgba(255,255,255,0.03)",
    line: "rgba(148,163,184,0.16)",
    indigo: "#6366f1",
    indigoLt: "#a5b4fc",
    green: "#34d399",
    amber: "#fbbf24",
    red: "#f87171",
    text: "#e5e7eb",
    sub: "#9ca3af",
    dim: "#6b7280",
};

function daysUntil(deadline?: string | null): number | null {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86400000);
}

export default function RequiredCheckTab() {
    const [contents, setContents] = useState<Content[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [completions, setCompletions] = useState<Completion[]>([]);
    const [targets, setTargets] = useState<Target[]>([]);
    const [deptMap, setDeptMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);
    const [onlyOverdue, setOnlyOverdue] = useState(false);

    const [editing, setEditing] = useState<Content | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);

        const { data: deptRows } = await supabase.from("departments").select("id, name");
        const dmap: Record<string, string> = {};
        (deptRows || []).forEach((d: any) => { dmap[d.id] = d.name; });
        setDeptMap(dmap);

        const { data: contentRows } = await supabase
            .from("contents")
            .select("id, title, category, is_required, deadline, is_active")
            .eq("is_required", true);
        const cs = ((contentRows || []) as Content[]).filter((c) => c.is_active !== false);
        setContents(cs);

        const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, name, department_id")
            .eq("is_active", true)
            .order("name");
        setProfiles((profileRows || []) as Profile[]);

        const ids = cs.map((c) => c.id);
        if (ids.length > 0) {
            const { data: compRows } = await supabase
                .from("content_completions")
                .select("content_id, user_id, status")
                .in("content_id", ids);
            setCompletions((compRows || []) as Completion[]);

            const { data: targetRows } = await supabase
                .from("content_targets")
                .select("content_id, user_id")
                .in("content_id", ids);
            setTargets((targetRows || []) as Target[]);
        } else {
            setCompletions([]);
            setTargets([]);
        }

        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const targetsOf = (contentId: string): Profile[] => {
        const ids = targets.filter((t) => t.content_id === contentId).map((t) => t.user_id);
        if (ids.length === 0) return profiles;
        const set = new Set(ids);
        return profiles.filter((p) => set.has(p.id));
    };
    const isAllTarget = (contentId: string) =>
        targets.filter((t) => t.content_id === contentId).length === 0;

    const openEditor = (c: Content) => {
        const cur = targets.filter((t) => t.content_id === c.id).map((t) => t.user_id);
        setSelected(new Set(cur));
        setSearch("");
        setEditing(c);
    };

    const saveTargets = async () => {
        if (!editing) return;
        setSaving(true);
        await supabase.from("content_targets").delete().eq("content_id", editing.id);
        const list = Array.from(selected);
        if (list.length > 0) {
            await supabase
                .from("content_targets")
                .insert(list.map((uid) => ({ content_id: editing.id, user_id: uid })));
        }
        setSaving(false);
        setEditing(null);
        await load();
    };

    const downloadCsv = (c: Content, notYet: Profile[], pending: Profile[]) => {
        const lines = ["氏名,部署,状態"];
        notYet.forEach((p) => lines.push(`${p.name},${deptMap[p.department_id || ""] || ""},未提出`));
        pending.forEach((p) => lines.push(`${p.name},${deptMap[p.department_id || ""] || ""},承認待ち`));
        const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `未完了_${c.title}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return <div style={{ padding: 40, textAlign: "center", color: CLR.indigo, fontWeight: 700 }}>Loading...</div>;
    }

    const rows = contents
        .map((c) => {
            const people = targetsOf(c.id);
            const mine = completions.filter((x) => x.content_id === c.id);
            const approvedIds = new Set(mine.filter((x) => x.status === "approved").map((x) => x.user_id));
            const pendingIds = new Set(mine.filter((x) => x.status !== "approved").map((x) => x.user_id));
            const approved = people.filter((p) => approvedIds.has(p.id));
            const pending = people.filter((p) => !approvedIds.has(p.id) && pendingIds.has(p.id));
            const notYet = people.filter((p) => !approvedIds.has(p.id) && !pendingIds.has(p.id));
            return { c, people, approved, pending, notYet, daysLeft: daysUntil(c.deadline) };
        })
        .sort((a, b) => (a.daysLeft === null ? 9999 : a.daysLeft) - (b.daysLeft === null ? 9999 : b.daysLeft));

    const visible = onlyOverdue
        ? rows.filter((r) => r.daysLeft !== null && r.daysLeft < 0 && r.notYet.length + r.pending.length > 0)
        : rows;

    const totalTargets = rows.reduce((a, r) => a + r.people.length, 0);
    const totalDone = rows.reduce((a, r) => a + r.approved.length, 0);
    const overallRate = totalTargets > 0 ? Math.round((totalDone / totalTargets) * 100) : 0;

    const filteredProfiles = search.trim()
        ? profiles.filter((p) => p.name.includes(search.trim()))
        : profiles;

    return (
        <div style={{ color: CLR.text }}>
            <div
                style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 12, padding: 16, borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.10))",
                    border: "1px solid rgba(99,102,241,0.3)", marginBottom: 16,
                }}
            >
                <div>
                    <div style={{ fontSize: 12, color: CLR.sub, marginBottom: 4 }}>
                        必修コンテンツ {rows.length} 件の全体完了率
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900 }}>
                        {overallRate}
                        <span style={{ fontSize: 14, color: CLR.sub }}>％（{totalDone} / {totalTargets}）</span>
                    </div>
                </div>
                <button
                    onClick={() => setOnlyOverdue((v) => !v)}
                    style={{
                        padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
                        color: onlyOverdue ? "#fff" : CLR.sub,
                        background: onlyOverdue ? CLR.red : "rgba(255,255,255,0.05)",
                        border: `1px solid ${onlyOverdue ? CLR.red : CLR.line}`,
                    }}
                >
                    🔴 期限超過のみ表示
                </button>
            </div>

            {visible.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: CLR.dim, fontSize: 13 }}>
                    {onlyOverdue ? "期限超過の未完了はありません" : "必修指定されたコンテンツがありません"}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visible.map((r) => {
                    const total = r.people.length;
                    const rate = total > 0 ? Math.round((r.approved.length / total) * 100) : 0;
                    const overdue = r.daysLeft !== null && r.daysLeft < 0;
                    const open = openId === r.c.id;
                    const all = isAllTarget(r.c.id);

                    return (
                        <div
                            key={r.c.id}
                            style={{
                                borderRadius: 14, background: CLR.bg,
                                border: `1px solid ${overdue ? "rgba(248,113,113,0.4)" : CLR.line}`,
                                overflow: "hidden",
                            }}
                        >
                            <div style={{ padding: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 9 }}>
                                    <span style={{ fontSize: 15, fontWeight: 800 }}>{r.c.title}</span>
                                    {r.c.category && (
                                        <span style={{
                                            fontSize: 10, fontWeight: 800, color: CLR.indigoLt,
                                            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                                            borderRadius: 5, padding: "2px 7px",
                                        }}>{r.c.category}</span>
                                    )}
                                    {r.c.deadline && (
                                        <span style={{ fontSize: 10.5, fontWeight: 700, color: overdue ? CLR.red : CLR.amber }}>
                                            締切 {r.c.deadline}
                                            {r.daysLeft !== null && (overdue ? `（${Math.abs(r.daysLeft)}日超過）` : `（残り${r.daysLeft}日）`)}
                                        </span>
                                    )}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                                    <span style={{
                                        fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6,
                                        color: all ? CLR.sub : CLR.green,
                                        background: all ? "rgba(255,255,255,0.05)" : "rgba(52,211,153,0.12)",
                                        border: `1px solid ${all ? CLR.line : "rgba(52,211,153,0.35)"}`,
                                    }}>
                                        {all ? `👥 対象：全員（${r.people.length}名）` : `🎯 対象：${r.people.length}名を指定`}
                                    </span>
                                    <button
                                        onClick={() => openEditor(r.c)}
                                        style={{
                                            padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                                            fontSize: 11.5, fontWeight: 700, color: CLR.indigoLt,
                                            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)",
                                        }}
                                    >
                                        ✏️ 対象を指定
                                    </button>
                                    <button
                                        onClick={() => setOpenId(open ? null : r.c.id)}
                                        style={{
                                            marginLeft: "auto", padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                                            fontSize: 11.5, fontWeight: 700, color: CLR.sub,
                                            background: "transparent", border: `1px solid ${CLR.line}`,
                                        }}
                                    >
                                        {open ? "▲ 閉じる" : "▼ 詳細"}
                                    </button>
                                </div>

                                <div style={{ display: "flex", gap: 14, fontSize: 12.5, fontWeight: 700, marginBottom: 9, flexWrap: "wrap" }}>
                                    <span style={{ color: CLR.green }}>✅ 完了 {r.approved.length}</span>
                                    <span style={{ color: CLR.amber }}>⏳ 承認待ち {r.pending.length}</span>
                                    <span style={{ color: overdue ? CLR.red : CLR.sub }}>❌ 未提出 {r.notYet.length}</span>
                                </div>

                                <div style={{ height: 7, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                                    <div style={{
                                        width: `${rate}%`, height: "100%", borderRadius: 99,
                                        background: rate === 100 ? CLR.green : CLR.indigo, transition: "width .6s",
                                    }} />
                                </div>
                                <div style={{ textAlign: "right", fontSize: 11, color: CLR.dim, marginTop: 5 }}>完了率 {rate}%</div>
                            </div>

                            {open && (
                                <div style={{ padding: 16, borderTop: `1px solid ${CLR.line}`, background: "rgba(0,0,0,0.2)" }}>
                                    <button
                                        onClick={() => downloadCsv(r.c, r.notYet, r.pending)}
                                        style={{
                                            padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700,
                                            color: CLR.indigoLt, background: "rgba(99,102,241,0.12)",
                                            border: "1px solid rgba(99,102,241,0.35)", marginBottom: 14,
                                        }}
                                    >
                                        📥 未完了者をCSV出力
                                    </button>
                                    <NameList title="❌ 未提出" color={CLR.red} people={r.notYet} deptMap={deptMap} />
                                    <NameList title="⏳ 承認待ち" color={CLR.amber} people={r.pending} deptMap={deptMap}
                                        note="承認は既存の学習承認タブから行ってください（ポイント付与のため）" />
                                    <NameList title="✅ 完了" color={CLR.green} people={r.approved} deptMap={deptMap} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {editing && (
                <div
                    onClick={() => setEditing(null)}
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000,
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "100%", maxWidth: 560, maxHeight: "86vh", display: "flex", flexDirection: "column",
                            background: "#141726", borderRadius: 16, border: "1px solid rgba(99,102,241,0.35)",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
                        }}
                    >
                        <div style={{ padding: 18, borderBottom: `1px solid ${CLR.line}` }}>
                            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>宿題の対象を指定</div>
                            <div style={{ fontSize: 12, color: CLR.sub }}>{editing.title}</div>
                            <div style={{ fontSize: 11, color: CLR.dim, marginTop: 6 }}>
                                誰も選ばずに保存すると「全員対象」になります
                            </div>
                        </div>

                        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${CLR.line}` }}>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="名前で検索"
                                style={{
                                    width: "100%", padding: "9px 12px", borderRadius: 9, fontSize: 13,
                                    color: CLR.text, background: "rgba(255,255,255,0.05)",
                                    border: `1px solid ${CLR.line}`, outline: "none", boxSizing: "border-box",
                                }}
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                <button
                                    onClick={() => setSelected(new Set(filteredProfiles.map((p) => p.id)))}
                                    style={smallBtn}
                                >
                                    表示中を全選択
                                </button>
                                <button onClick={() => setSelected(new Set())} style={smallBtn}>
                                    全解除
                                </button>
                                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: CLR.indigoLt }}>
                                    {selected.size}名 選択中
                                </span>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                            {filteredProfiles.map((p) => {
                                const on = selected.has(p.id);
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            const next = new Set(selected);
                                            if (on) next.delete(p.id); else next.add(p.id);
                                            setSelected(next);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                                            borderRadius: 9, cursor: "pointer", marginBottom: 4,
                                            background: on ? "rgba(99,102,241,0.16)" : "transparent",
                                            border: `1px solid ${on ? "rgba(99,102,241,0.4)" : "transparent"}`,
                                        }}
                                    >
                                        <span style={{
                                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 11, color: on ? "#fff" : "transparent",
                                            background: on ? CLR.indigo : "transparent",
                                            border: `1px solid ${on ? CLR.indigo : CLR.line}`,
                                        }}>✓</span>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                                        {p.department_id && deptMap[p.department_id] && (
                                            <span style={{ fontSize: 10.5, color: CLR.dim, marginLeft: "auto" }}>
                                                {deptMap[p.department_id]}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredProfiles.length === 0 && (
                                <div style={{ padding: 24, textAlign: "center", color: CLR.dim, fontSize: 12 }}>
                                    該当するメンバーがいません
                                </div>
                            )}
                        </div>

                        <div style={{ padding: 14, borderTop: `1px solid ${CLR.line}`, display: "flex", gap: 10 }}>
                            <button
                                onClick={() => setEditing(null)}
                                style={{ ...smallBtn, flex: 1, padding: "11px 0", fontSize: 13 }}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={saveTargets}
                                disabled={saving}
                                style={{
                                    flex: 2, padding: "11px 0", borderRadius: 10, cursor: saving ? "default" : "pointer",
                                    fontSize: 13, fontWeight: 800, color: "#fff",
                                    background: saving ? "rgba(99,102,241,0.4)" : CLR.indigo,
                                    border: "none",
                                }}
                            >
                                {saving ? "保存中…" : "保存する"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function NameList({
    title, color, people, deptMap, note,
}: {
    title: string; color: string; people: Profile[];
    deptMap: Record<string, string>; note?: string;
}) {
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 3 }}>
                {title}（{people.length}名）
            </div>
            {note && <div style={{ fontSize: 10.5, color: CLR.dim, marginBottom: 6 }}>{note}</div>}
            {people.length === 0 ? (
                <div style={{ fontSize: 11.5, color: CLR.dim }}>該当者なし</div>
            ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {people.map((p) => (
                        <span key={p.id} style={{
                            fontSize: 11.5, padding: "4px 9px", borderRadius: 7,
                            background: "rgba(255,255,255,0.05)", border: `1px solid ${CLR.line}`,
                        }}>
                            {p.name}
                            {p.department_id && deptMap[p.department_id] && (
                                <span style={{ color: CLR.dim, marginLeft: 5, fontSize: 10 }}>
                                    {deptMap[p.department_id]}
                                </span>
                            )}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

const smallBtn: React.CSSProperties = {
    padding: "6px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 700,
    color: CLR.sub,
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${CLR.line}`,
};
