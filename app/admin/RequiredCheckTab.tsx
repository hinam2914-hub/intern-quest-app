"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/* ============================================================================
   必修コンテンツ 完了チェック（管理者用）
   - 必修指定されたコンテンツごとに「完了 / 承認待ち / 未提出」を集計
   - 未提出者の名前一覧・CSV出力
   - 承認操作はここでは行いません（既存の承認タブのポイント付与ロジックを通すため）
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

type Profile = {
    id: string;
    name: string;
    department_id?: string | null;
};

type Completion = {
    content_id: string;
    user_id: string;
    status: string | null;
};

type Row = {
    content: Content;
    approved: Profile[];
    pending: Profile[];
    notYet: Profile[];
    daysLeft: number | null;
};

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
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);
    const [onlyOverdue, setOnlyOverdue] = useState(false);
    const [deptMap, setDeptMap] = useState<Record<string, string>>({});

    useEffect(() => {
        (async () => {
            setLoading(true);

            const { data: deptRows } = await supabase.from("departments").select("id, name");
            const dmap: Record<string, string> = {};
            (deptRows || []).forEach((d: any) => { dmap[d.id] = d.name; });
            setDeptMap(dmap);

            const { data: contentRows } = await supabase
                .from("contents")
                .select("id, title, category, is_required, deadline, is_active")
                .eq("is_required", true);

            const contents = (contentRows || []).filter((c: any) => c.is_active !== false) as Content[];

            const { data: profileRows } = await supabase
                .from("profiles")
                .select("id, name, department_id")
                .eq("is_active", true);
            const profiles = (profileRows || []) as Profile[];

            const contentIds = contents.map((c) => c.id);
            let completions: Completion[] = [];
            if (contentIds.length > 0) {
                const { data: compRows } = await supabase
                    .from("content_completions")
                    .select("content_id, user_id, status")
                    .in("content_id", contentIds);
                completions = (compRows || []) as Completion[];
            }

            const built: Row[] = contents.map((c) => {
                const mine = completions.filter((x) => x.content_id === c.id);
                const approvedIds = new Set(mine.filter((x) => x.status === "approved").map((x) => x.user_id));
                const pendingIds = new Set(
                    mine.filter((x) => x.status !== "approved").map((x) => x.user_id)
                );

                const approved = profiles.filter((p) => approvedIds.has(p.id));
                const pending = profiles.filter((p) => !approvedIds.has(p.id) && pendingIds.has(p.id));
                const notYet = profiles.filter((p) => !approvedIds.has(p.id) && !pendingIds.has(p.id));

                return { content: c, approved, pending, notYet, daysLeft: daysUntil(c.deadline) };
            });

            built.sort((a, b) => {
                const ad = a.daysLeft === null ? 9999 : a.daysLeft;
                const bd = b.daysLeft === null ? 9999 : b.daysLeft;
                return ad - bd;
            });

            setRows(built);
            setLoading(false);
        })();
    }, []);

    const downloadCsv = (row: Row) => {
        const lines = ["氏名,部署,状態"];
        row.notYet.forEach((p) =>
            lines.push(`${p.name},${deptMap[p.department_id || ""] || ""},未提出`)
        );
        row.pending.forEach((p) =>
            lines.push(`${p.name},${deptMap[p.department_id || ""] || ""},承認待ち`)
        );
        const csv = "\uFEFF" + lines.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `未完了_${row.content.title}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const visible = onlyOverdue
        ? rows.filter((r) => r.daysLeft !== null && r.daysLeft < 0 && r.notYet.length + r.pending.length > 0)
        : rows;

    if (loading) {
        return (
            <div style={{ padding: 40, textAlign: "center", color: CLR.indigo, fontWeight: 700 }}>
                Loading...
            </div>
        );
    }

    const totalTargets = rows.reduce((a, r) => a + r.approved.length + r.pending.length + r.notYet.length, 0);
    const totalDone = rows.reduce((a, r) => a + r.approved.length, 0);
    const overallRate = totalTargets > 0 ? Math.round((totalDone / totalTargets) * 100) : 0;

    return (
        <div style={{ color: CLR.text }}>
            {/* サマリー */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    padding: 16,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.10))",
                    border: "1px solid rgba(99,102,241,0.3)",
                    marginBottom: 16,
                }}
            >
                <div>
                    <div style={{ fontSize: 12, color: CLR.sub, marginBottom: 4 }}>
                        必修コンテンツ {rows.length} 件の全体完了率
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900 }}>
                        {overallRate}
                        <span style={{ fontSize: 14, color: CLR.sub }}>
                            % （{totalDone} / {totalTargets}）
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setOnlyOverdue((v) => !v)}
                    style={{
                        padding: "9px 16px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 700,
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
                    {onlyOverdue
                        ? "期限超過の未完了はありません"
                        : "必修指定されたコンテンツがありません"}
                </div>
            )}

            {/* コンテンツ別 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visible.map((r) => {
                    const total = r.approved.length + r.pending.length + r.notYet.length;
                    const rate = total > 0 ? Math.round((r.approved.length / total) * 100) : 0;
                    const overdue = r.daysLeft !== null && r.daysLeft < 0;
                    const open = openId === r.content.id;

                    return (
                        <div
                            key={r.content.id}
                            style={{
                                borderRadius: 14,
                                background: CLR.bg,
                                border: `1px solid ${overdue ? "rgba(248,113,113,0.4)" : CLR.line}`,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                onClick={() => setOpenId(open ? null : r.content.id)}
                                style={{ padding: 16, cursor: "pointer" }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        flexWrap: "wrap",
                                        marginBottom: 8,
                                    }}
                                >
                                    <span style={{ fontSize: 15, fontWeight: 800 }}>
                                        {r.content.title}
                                    </span>
                                    {r.content.category && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 800,
                                                color: CLR.indigoLt,
                                                background: "rgba(99,102,241,0.15)",
                                                border: "1px solid rgba(99,102,241,0.3)",
                                                borderRadius: 5,
                                                padding: "2px 7px",
                                            }}
                                        >
                                            {r.content.category}
                                        </span>
                                    )}
                                    {r.content.deadline && (
                                        <span
                                            style={{
                                                fontSize: 10.5,
                                                fontWeight: 700,
                                                color: overdue ? CLR.red : CLR.amber,
                                            }}
                                        >
                                            締切 {r.content.deadline}
                                            {r.daysLeft !== null &&
                                                (overdue
                                                    ? `（${Math.abs(r.daysLeft)}日超過）`
                                                    : `（残り${r.daysLeft}日）`)}
                                        </span>
                                    )}
                                    <span style={{ marginLeft: "auto", fontSize: 12, color: CLR.dim }}>
                                        {open ? "▲ 閉じる" : "▼ 詳細"}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        gap: 14,
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        marginBottom: 9,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <span style={{ color: CLR.green }}>✅ 完了 {r.approved.length}</span>
                                    <span style={{ color: CLR.amber }}>⏳ 承認待ち {r.pending.length}</span>
                                    <span style={{ color: overdue ? CLR.red : CLR.sub }}>
                                        ❌ 未提出 {r.notYet.length}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        height: 7,
                                        borderRadius: 99,
                                        background: "rgba(255,255,255,0.07)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${rate}%`,
                                            height: "100%",
                                            borderRadius: 99,
                                            background: rate === 100 ? CLR.green : CLR.indigo,
                                            transition: "width .6s",
                                        }}
                                    />
                                </div>
                                <div style={{ textAlign: "right", fontSize: 11, color: CLR.dim, marginTop: 5 }}>
                                    完了率 {rate}%
                                </div>
                            </div>

                            {open && (
                                <div
                                    style={{
                                        padding: 16,
                                        borderTop: `1px solid ${CLR.line}`,
                                        background: "rgba(0,0,0,0.2)",
                                    }}
                                >
                                    <button
                                        onClick={() => downloadCsv(r)}
                                        style={{
                                            padding: "8px 14px",
                                            borderRadius: 9,
                                            cursor: "pointer",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: CLR.indigoLt,
                                            background: "rgba(99,102,241,0.12)",
                                            border: "1px solid rgba(99,102,241,0.35)",
                                            marginBottom: 14,
                                        }}
                                    >
                                        📥 未完了者をCSV出力
                                    </button>

                                    <NameList
                                        title="❌ 未提出"
                                        color={CLR.red}
                                        people={r.notYet}
                                        deptMap={deptMap}
                                    />
                                    <NameList
                                        title="⏳ 承認待ち"
                                        color={CLR.amber}
                                        people={r.pending}
                                        deptMap={deptMap}
                                        note="承認は既存の学習承認タブから行ってください（ポイント付与のため）"
                                    />
                                    <NameList
                                        title="✅ 完了"
                                        color={CLR.green}
                                        people={r.approved}
                                        deptMap={deptMap}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function NameList({
    title,
    color,
    people,
    deptMap,
    note,
}: {
    title: string;
    color: string;
    people: Profile[];
    deptMap: Record<string, string>;
    note?: string;
}) {
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 3 }}>
                {title}（{people.length}名）
            </div>
            {note && (
                <div style={{ fontSize: 10.5, color: CLR.dim, marginBottom: 6 }}>{note}</div>
            )}
            {people.length === 0 ? (
                <div style={{ fontSize: 11.5, color: CLR.dim }}>該当者なし</div>
            ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {people.map((p) => (
                        <span
                            key={p.id}
                            style={{
                                fontSize: 11.5,
                                padding: "4px 9px",
                                borderRadius: 7,
                                background: "rgba(255,255,255,0.05)",
                                border: `1px solid ${CLR.line}`,
                            }}
                        >
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
