"use client";
// 生活改善・時間価値テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "life_improvement",
    "title": "生活改善・時間価値テスト",
    "path": "/tests/life-improvement",
    "written": [
        "Q16. 最近、自分が無駄にした時間を書いてください",
        "Q17. 「堕落しやすい人」の特徴を書いてください",
        "Q18. 今の自分が改善すべき生活習慣を書いてください",
        "Q19. 5年後に差がつくと思う日常習慣を3つ書いてください",
        "Q20. 時間を無駄にしないための工夫を書いてください",
        "Q21. 今後\"絶対に積み上げたい習慣\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
