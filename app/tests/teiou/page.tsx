"use client";
// Dot.A 帝王学。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "teiou",
    "title": "Dot.A 帝王学",
    "path": "/tests/teiou",
    "written": [
        "Q16. 「wantを選べる人生」とは何か、自分の言葉で説明してください",
        "Q17. 「複利」が人生に与える影響を説明してください",
        "Q18. 「20代で最優先すべきこと」を書いてください",
        "Q19. 「自分で稼ぐ力」が必要な理由を書いてください",
        "Q20. 「弱い人が陥りやすい思考」を3つ書いてください",
        "Q21. 5年後の自分のために、今やるべきことを書いてください"
    ],
    "writtenFormat": "qa",
    "writtenRule": "any"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
