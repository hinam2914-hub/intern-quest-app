"use client";
// 企画職適性テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "planner",
    "title": "企画職適性テスト",
    "path": "/tests/planner",
    "written": [
        "なぜ営業経験が企画に必要なのか説明してください",
        "売れる企画と売れない企画の違いを具体的に書いてください",
        "売れる導線（認知→興味→比較→行動）を説明してください",
        "今の事業で改善できる企画案を1つ出してください",
        "企画が失敗する原因と対策を書いてください",
        "自分が企画職に足りていないもの"
    ],
    "writtenFormat": "list",
    "writtenRule": "none",
    "rank": true
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
