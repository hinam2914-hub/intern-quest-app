"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function CompanyManagementTab() {
    const [companies, setCompanies] = useState<any[]>([]);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [industry, setIndustry] = useState("");
    const [tier, setTier] = useState<"S" | "A" | "B" | "C" | "D" | "E">("C");
    const [notes, setNotes] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [csvText, setCsvText] = useState("");
    const [importing, setImporting] = useState(false);
    const [importMessage, setImportMessage] = useState("");
    const [tierFilter, setTierFilter] = useState<string>("all");
    const [searchText, setSearchText] = useState("");

    const reload = async () => {
        const { data } = await supabase.from("companies").select("*").order("tier").order("name");
        setCompanies(data || []);
    };

    useEffect(() => { reload(); }, []);

    const reset = () => {
        setEditingId(null);
        setName(""); setUrl(""); setIndustry(""); setTier("C"); setNotes("");
    };

    const handleSave = async () => {
        if (!name) { alert("企業名は必須です"); return; }
        const data = {
            name: name.trim(),
            website_url: url.trim() || null,
            industry: industry.trim() || null,
            tier,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
        };
        let error;
        if (editingId) {
            ({ error } = await supabase.from("companies").update(data).eq("id", editingId));
        } else {
            ({ error } = await supabase.from("companies").insert(data));
        }
        if (error) { alert("保存失敗: " + error.message); return; }
        alert(editingId ? "✅ 更新しました" : "✅ 登録しました");
        reset();
        await reload();
    };

    const handleEdit = (c: any) => {
        setEditingId(c.id);
        setName(c.name || ""); setUrl(c.website_url || "");
        setIndustry(c.industry || ""); setTier(c.tier || "C");
        setNotes(c.notes || "");
    };

    const handleDelete = async (id: string) => {
        if (!confirm("本当に削除しますか？")) return;
        const { error } = await supabase.from("companies").delete().eq("id", id);
        if (error) { alert("削除失敗: " + error.message); return; }
        setCompanies(prev => prev.filter(c => c.id !== id));
    };

    const handleCsvImport = async () => {
        if (!csvText.trim()) { setImportMessage("❌ CSVテキストを貼り付けてください"); return; }
        setImporting(true); setImportMessage("");

        const lines = csvText.trim().split("\n").filter(l => l.trim());
        const records: any[] = [];
        let skipped = 0;

        for (const line of lines) {
            const cols = line.includes("\t") ? line.split("\t") : line.split(",");
            const [n, u, i, t] = cols.map(c => c.trim());
            if (!n || !t) { skipped++; continue; }
            if (!["S", "A", "B", "C", "D", "E"].includes(t)) { skipped++; continue; }
            if (n === "企業名" || n === "name") { skipped++; continue; }
            // 重複チェック（同じCSV内で同じ企業名がある場合は最後の行を採用）
            const existingIndex = records.findIndex(r => r.name === n);
            if (existingIndex !== -1) {
                records[existingIndex] = { name: n, website_url: u || null, industry: i || null, tier: t };
                skipped++;
            } else {
                records.push({ name: n, website_url: u || null, industry: i || null, tier: t });
            }
        }

        if (records.length === 0) { setImportMessage("❌ 有効なレコードがありません"); setImporting(false); return; }

        const { error } = await supabase.from("companies").upsert(records, { onConflict: "name" });
        if (error) { setImportMessage("❌ 失敗: " + error.message); setImporting(false); return; }

        setImportMessage(`✅ ${records.length}社を登録しました（スキップ: ${skipped}行）`);
        setCsvText("");
        await reload();
        setImporting(false);
    };

    const tierColor: Record<string, string> = { S: "#fbbf24", A: "#a855f7", B: "#06b6d4", C: "#10b981", D: "#f97316", E: "#6b7280" };

    return (
        <div>
            <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>🏢 企業管理</div>
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>就活市場の企業マスタを管理します。ティアS〜Eで分類し、ユーザーの就活ランクとマッチングします。</div>
            </div>

            {/* CSV一括インポート */}
            <div style={{ marginBottom: 24, padding: 20, borderRadius: 12, background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)" }}>
                <div style={{ fontSize: 13, color: "#c084fc", fontWeight: 700, marginBottom: 12 }}>📤 CSV一括インポート</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8, lineHeight: 1.7 }}>
                    形式：「企業名,HP,業界,ティア」（カンマ or タブ区切り）<br />
                    例：レバレジーズ株式会社,https://leverages.jp/,人材,A
                </div>
                <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="ここに企業データをペースト（1行1社）" style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 12, outline: "none", boxSizing: "border-box", minHeight: 120, resize: "vertical", fontFamily: "monospace" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: importMessage.includes("✅") ? "#34d399" : importMessage.includes("❌") ? "#f87171" : "#6b7280", fontWeight: 600 }}>{importMessage}</div>
                    <button onClick={handleCsvImport} disabled={importing} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: importing ? "rgba(168,85,247,0.4)" : "linear-gradient(135deg, #a855f7, #c084fc)", color: "#fff", fontWeight: 700, cursor: importing ? "not-allowed" : "pointer", fontSize: 13 }}>
                        {importing ? "登録中..." : "📤 一括インポート"}
                    </button>
                </div>
            </div>

            {/* ティア別カウント */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 16 }}>
                {(["S", "A", "B", "C", "D", "E"] as const).map(t => (
                    <div key={t} style={{ padding: 12, borderRadius: 10, background: `${tierColor[t]}15`, border: `1px solid ${tierColor[t]}40`, textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: tierColor[t] }}>{t}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>{companies.filter(c => c.tier === t).length}</div>
                    </div>
                ))}
            </div>

            {/* 個別追加・編集 */}
            <div style={{ marginBottom: 24, padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 13, color: "#f9fafb", fontWeight: 700, marginBottom: 12 }}>{editingId ? "✏️ 編集中" : "➕ 個別追加"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="企業名 *" style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, outline: "none" }} />
                    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="HP URL" style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, outline: "none" }} />
                    <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="業界（例：人材／IT）" style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, outline: "none" }} />
                    <select value={tier} onChange={(e) => setTier(e.target.value as any)} style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 13, outline: "none" }}>
                        <option value="S">S（最上位）</option>
                        <option value="A">A（上位）</option>
                        <option value="B">B（中上位）</option>
                        <option value="C">C（中位）</option>
                        <option value="D">D（下位）</option>
                        <option value="E">E（最下位）</option>
                    </select>
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="メモ（任意）" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box", minHeight: 60, resize: "vertical", fontFamily: "inherit", marginBottom: 12 }} />
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleSave} style={{ flex: 1, padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                        💾 {editingId ? "更新する" : "登録する"}
                    </button>
                    {editingId && (
                        <button onClick={reset} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                            キャンセル
                        </button>
                    )}
                </div>
            </div>

            {/* フィルタと検索 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 12, outline: "none" }}>
                    <option value="all">全ティア</option>
                    <option value="S">S</option><option value="A">A</option><option value="B">B</option>
                    <option value="C">C</option><option value="D">D</option><option value="E">E</option>
                </select>
                <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="🔍 企業名・業界で検索" style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 12, outline: "none" }} />
            </div>

            {/* 企業一覧 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {companies.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14, background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>企業データはまだありません</div>
                ) : (
                    companies
                        .filter(c => tierFilter === "all" || c.tier === tierFilter)
                        .filter(c => !searchText || c.name.toLowerCase().includes(searchText.toLowerCase()) || (c.industry || "").toLowerCase().includes(searchText.toLowerCase()))
                        .map(c => (
                            <div key={c.id} style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 6, background: `${tierColor[c.tier]}25`, border: `1px solid ${tierColor[c.tier]}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: tierColor[c.tier], flexShrink: 0 }}>{c.tier}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                                    <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {c.industry || "業界未設定"}{c.website_url && ` ・ ${c.website_url}`}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                    <button onClick={() => handleEdit(c)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️</button>
                                    <button onClick={() => handleDelete(c.id)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🗑️</button>
                                </div>
                            </div>
                        ))
                )}
            </div>
        </div>
    );
}