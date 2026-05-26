"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

interface Routine {
    id: string;
    title: string;
    sort_order: number;
}

export default function RoutinePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState("");
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [newTitle, setNewTitle] = useState("");
    const [message, setMessage] = useState("");

    // 初回ロード：ログインユーザーと、そのルーティン項目を取得
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data } = await supabase
                .from("routines")
                .select("id, title, sort_order")
                .eq("user_id", user.id)
                .eq("is_active", true)
                .order("sort_order", { ascending: true });
            setRoutines(data || []);
            setLoading(false);
        })();
    }, [router]);

    // 項目を追加
    const addRoutine = async () => {
        if (!newTitle.trim()) { setMessage("項目名を入力してください"); return; }
        if (routines.length >= 10) { setMessage("ルーティンは10個までです"); return; }
        setSaving(true);
        setMessage("");
        const nextOrder = routines.length > 0 ? Math.max(...routines.map((r) => r.sort_order)) + 1 : 0;
        const { data, error } = await supabase
            .from("routines")
            .insert({ user_id: userId, title: newTitle.trim(), sort_order: nextOrder })
            .select("id, title, sort_order")
            .single();
        if (error) { setMessage("追加に失敗しました: " + error.message); setSaving(false); return; }
        if (data) setRoutines([...routines, data]);
        setNewTitle("");
        setSaving(false);
    };

    // 項目を削除（is_active を false にするだけ。記録は残す）
    const deleteRoutine = async (id: string) => {
        setSaving(true);
        const { error } = await supabase.from("routines").update({ is_active: false }).eq("id", id);
        if (error) { setMessage("削除に失敗しました: " + error.message); setSaving(false); return; }
        setRoutines(routines.filter((r) => r.id !== id));
        setSaving(false);
    };

    if (loading) {
        return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1a", color: "#9ca3af" }}>読み込み中...</div>;
    }

    return (
        <div style={{ minHeight: "100vh", background: "#0f0f1a", padding: "32px 20px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
                <button onClick={() => router.push("/mypage")} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 14, marginBottom: 20 }}>← マイページに戻る</button>

                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>🔁 マイルーティン設定</h1>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>毎日続けたいことを登録しましょう。登録した項目はマイページの「今日のミッション」に表示され、毎日チェックできます。</p>

                {/* 項目の追加 */}
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addRoutine(); }}
                        placeholder="例：架電30件、学習コンテンツ1本"
                        style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none" }}
                    />
                    <button
                        onClick={addRoutine}
                        disabled={saving}
                        style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 14, whiteSpace: "nowrap" }}
                    >
                        追加
                    </button>
                </div>
                {message && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 12 }}>{message}</div>}

                {/* 項目の一覧 */}
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    {routines.length === 0 ? (
                        <div style={{ padding: 24, borderRadius: 12, background: "rgba(255,255,255,0.03)", textAlign: "center", color: "#6b7280", fontSize: 14 }}>
                            まだルーティンがありません。上の欄から追加してください。
                        </div>
                    ) : (
                        routines.map((r, i) => (
                            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
                                <span style={{ flex: 1, fontSize: 15 }}>{r.title}</span>
                                <button
                                    onClick={() => deleteRoutine(r.id)}
                                    disabled={saving}
                                    style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13 }}
                                >
                                    削除
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}