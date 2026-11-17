"use client";
// 論理思考・感情逃避防止テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "logical_thinking",
    "title": "論理思考・感情逃避防止テスト",
    "path": "/tests/logical-thinking",
    "written": [
        "Q16. 最近、自分が\"感情で話してしまった\"経験を書いてください",
        "Q17. 「論理が弱い人」の特徴を書いてください",
        "Q18. 「自分はこう思う」を論理的に説明するには何が必要か書いてください",
        "Q19. 最近納得できなかったことを、\"感情\"ではなく\"構造\"で説明してください",
        "Q20. 論理的に話せる人の特徴を書いてください",
        "Q21. 今の自分が\"勢いでごまかしている部分\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
