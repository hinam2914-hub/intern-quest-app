"use client";
// 資格依存・市場価値現実テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "cert_market_value",
    "title": "資格依存・市場価値現実テスト",
    "path": "/tests/cert-market-value",
    "written": [
        "Q16. 「資格」と「市場価値」の違いを書いてください",
        "Q17. 今の時代に価値が高い人材の特徴を書いてください",
        "Q18. 自分が\"勉強した気\"になっている部分を書いてください",
        "Q19. 実務経験が重要な理由を書いてください",
        "Q20. 今後AI時代で価値が上がる能力を書いてください",
        "Q21. 今後、自分が積むべき\"経験\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
