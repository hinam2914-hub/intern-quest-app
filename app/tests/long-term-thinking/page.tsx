"use client";
// 長期思考・複利思考。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "long_term_thinking",
    "title": "長期思考・複利思考",
    "path": "/tests/long-term-thinking",
    "written": [
        "Q16. 「5年前にやっておけば良かったこと」を書いてください",
        "Q17. 「長期で得する行動」を3つ書いてください",
        "Q18. 今の自分が「短期快楽」に使いすぎているものを書いてください",
        "Q19. 5年後の自分に最も利益がある習慣を書いてください",
        "Q20. 「複利」とは何かを自分なりに説明してください",
        "Q21. 10年後の自分を良くするために、今やるべきことを書いてください"
    ],
    "writtenFormat": "qa",
    "writtenRule": "any"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
