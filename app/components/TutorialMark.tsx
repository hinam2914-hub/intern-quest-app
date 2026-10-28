"use client";
// 画面を開いたことをチュートリアル進捗に記録するだけの部品（表示なし）。
// HOME／SKILL WORLD／今日のクエスト（予定）に 1 行ずつ置く。既存の処理には触れない。
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { markTutorial, type TutorialKey } from "../lib/tutorial";

export default function TutorialMark({ id }: { id: TutorialKey }) {
    useEffect(() => {
        let alive = true;
        supabase.auth.getUser().then(({ data: { user } }) => { if (alive && user) markTutorial(user.id, id); }).catch(() => {});
        return () => { alive = false; };
    }, [id]);
    return null;
}
