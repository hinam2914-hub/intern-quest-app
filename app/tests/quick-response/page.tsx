"use client";
// 即レス・反応速度テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "quick_response",
    "title": "即レス・反応速度テスト",
    "path": "/tests/quick-response",
    "written": [
        "Q16. 最近\"返信遅れ\"で困った経験を書いてください",
        "Q17. 「返信が早い人」の特徴を書いてください",
        "Q18. 自分が返信を後回しにする原因を書いてください",
        "Q19. 即レスを習慣化する方法を書いてください",
        "Q20. \"返信速度\"が信頼に影響する理由を書いてください",
        "Q21. 今後、自分が改善したい\"レスポンス習慣\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
