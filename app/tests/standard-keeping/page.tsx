"use client";
// 基準維持・妥協耐性。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "standard_keeping",
    "title": "基準維持・妥協耐性",
    "path": "/tests/standard-keeping",
    "written": [
        "Q16. 最近、自分が妥協したことを書いてください",
        "Q17. 基準が高い人の特徴を書いてください",
        "Q18. まあいいかで失敗した経験を書いてください",
        "Q19. 今後、自分が絶対に下げたくない基準を3つ書いてください",
        "Q20. 継続と基準の関係を説明してください",
        "Q21. 5年後に差がつくと思う日常の小さい行動を書いてください"
    ],
    "writtenFormat": "qa",
    "writtenRule": "any"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
