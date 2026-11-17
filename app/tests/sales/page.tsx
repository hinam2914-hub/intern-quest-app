"use client";
// 営業デビュー適性テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "sales",
    "title": "営業デビュー適性テスト",
    "path": "/tests/sales",
    "written": [
        "営業で「信頼を得る行動」を3つ書いてください",
        "なぜ営業は断られるのか説明してください",
        "ヒアリングで聞くべき内容を3つ書いてください",
        "自分が営業でつまずきそうなポイントと対策",
        "1ヶ月で成果を出すための行動計画",
        "なぜ営業をやるのか"
    ],
    "writtenFormat": "list",
    "writtenRule": "none",
    "rank": true
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
