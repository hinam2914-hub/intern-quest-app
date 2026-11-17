"use client";
// 保身・自己防衛過剰改善テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "self_protection",
    "title": "保身・自己防衛過剰改善テスト",
    "path": "/tests/self-protection",
    "written": [
        "Q16. 最近、自分が\"保身に走った\"と思う経験を書いてください",
        "Q17. 「保身が強い人」の特徴を書いてください",
        "Q18. 自分が言い訳しやすい場面を書いてください",
        "Q19. \"責任感が強い人\"の特徴を書いてください",
        "Q20. 保身を減らすために必要なことを書いてください",
        "Q21. 今の自分が\"逃げている部分\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
