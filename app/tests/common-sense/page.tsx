"use client";
// 常識・デリカシーテスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "common_sense",
    "title": "常識・デリカシーテスト",
    "path": "/tests/common-sense",
    "written": [
        "Q16. 「感じがいい人」の特徴を書いてください",
        "Q17. 「デリカシーがない」とはどういう状態か説明してください",
        "Q18. 過去に「空気読めなかった」経験を書いてください",
        "Q19. 人間関係で信頼を積む方法を3つ書いてください",
        "Q20. 自分が改善したいコミュニケーション面",
        "Q21. 「一緒に働きたい人」の特徴を書いてください"
    ],
    "writtenFormat": "qa",
    "writtenRule": "any"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
