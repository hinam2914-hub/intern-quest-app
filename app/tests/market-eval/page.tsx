"use client";
// 市場価値・評価認識テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "market_eval",
    "title": "市場価値・評価認識テスト",
    "path": "/tests/market-eval",
    "written": [
        "Q16. 「市場価値」とは何か、自分の言葉で説明してください",
        "Q17. 今の自分が\"自己評価基準\"になっている部分を書いてください",
        "Q18. 「評価される人」の特徴を書いてください",
        "Q19. 自分が今後、社会で価値を上げるために必要なことを書いてください",
        "Q20. 「頑張った」と「価値提供」の違いを書いてください",
        "Q21. 今の自分が\"相場感覚不足\"だと思う部分を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
