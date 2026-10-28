"use client";
// 画面を開いたことをチュートリアル進捗に記録する部品。HOME／SKILL WORLD／今日のクエスト（予定）に 1 行ずつ置く。
// 通常は何も表示しない。STEP 7（3/4）の案内から来たときだけ、ルクの小さなパネル（達成の知らせ＋チュートリアルへ戻る）を出す。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { markTutorial, getTutorialReturn, clearTutorialReturn, readTutorial, TUTORIAL_KEYS, type TutorialKey } from "../lib/tutorial";

const LABEL: Record<TutorialKey, string> = { home: "HOMEを探検", skill: "SKILL WORLDを開く", quest: "今日のクエストを確認" };

export default function TutorialMark({ id }: { id: TutorialKey }) {
    const router = useRouter();
    const [panel, setPanel] = useState<{ userId: string; to: string; left: number } | null>(null);
    useEffect(() => {
        let alive = true;
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!alive || !user) return;
            markTutorial(user.id, id);
            const to = getTutorialReturn(user.id);
            if (to) { const p = readTutorial(user.id); setPanel({ userId: user.id, to, left: TUTORIAL_KEYS.filter((k) => !p[k]).length }); }
        }).catch(() => {});
        return () => { alive = false; };
    }, [id]);
    if (!panel) return null;
    const back = () => { clearTutorialReturn(panel.userId); router.push(panel.to); };
    return (
        <div style={{ position: "fixed", left: 12, right: 12, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 9999, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, maxWidth: 520, width: "100%", background: "linear-gradient(180deg,#fffdf4,#f6ead0)", border: "2px solid #d8b55e", borderRadius: 18, padding: "8px 10px 8px 8px", boxShadow: "0 0 0 3px rgba(255,255,255,.5),0 10px 24px rgba(30,60,120,.3)", fontFamily: 'system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif' }}>
                <img src="/onboarding/luku.png" alt="" style={{ width: 52, height: 52, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#17397d" }}>「{LABEL[id]}」達成！</div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "#5a3d12" }}>{panel.left > 0 ? `あと ${panel.left} つ。見終わったらチュートリアルに戻ろう` : "3つクリア！チュートリアルに戻って報告しよう"}</div>
                </div>
                <button type="button" onClick={back} style={{ flex: "none", border: "2px solid #e8c45a", background: "linear-gradient(180deg,#4d9af5,#2458c7)", color: "#fff", fontWeight: 900, fontSize: 12.5, borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>戻る →</button>
            </div>
        </div>
    );
}
