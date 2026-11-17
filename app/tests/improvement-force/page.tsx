"use client";
// 改善力・逃避防止テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "improvement_force",
    "title": "改善力・逃避防止テスト",
    "path": "/tests/improvement-force",
    "written": [
        "Q16. 最近受けた指摘と、その後どう改善したかを書いてください",
        "Q17. 「改善できない人」の特徴を書いてください",
        "Q18. \"宣言だけで終わった経験\"を書いてください",
        "Q19. 今後繰り返したくないミスと、その対策を書いてください",
        "Q20. 「改善力が高い人」の特徴を書いてください",
        "Q21. 今の自分が\"口だけになっている部分\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
