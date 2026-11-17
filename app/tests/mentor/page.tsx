"use client";
// メンターテスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "mentor",
    "title": "メンターテスト",
    "path": "/tests/mentor",
    "written": [
        "「後輩を成長させるために必要な要素」を3つ書いてください",
        "「教える」と「育てる」の違いを説明してください",
        "「後輩が動かない原因」とその解決策を書いてください",
        "「自分のメンタリングの課題」と改善策を書いてください",
        "「後輩が成果を出すためにメンターができること」を具体的に書いてください",
        "「信頼されるメンターとはどんな人か」を定義してください"
    ],
    "writtenFormat": "list",
    "writtenRule": "none"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
