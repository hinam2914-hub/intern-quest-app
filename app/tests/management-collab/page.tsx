"use client";
// マネジメント・協働価値テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "management_collab",
    "title": "マネジメント・協働価値テスト",
    "path": "/tests/management-collab",
    "written": [
        "Q16. 「マネジメント力」とは何か、自分の言葉で説明してください",
        "Q17. 最近、他人との連携不足で起きた問題を書いてください",
        "Q18. \"協働が弱い人\"の特徴を書いてください",
        "Q19. 今の自分が\"自分視点\"になっている部分を書いてください",
        "Q20. 「周囲を動かせる人」の特徴を書いてください",
        "Q21. 今後、自分が強化すべき\"協働力\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
