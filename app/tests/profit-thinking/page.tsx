"use client";
// 利益思考・判断センス。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "profit_thinking",
    "title": "利益思考・判断センス",
    "path": "/tests/profit-thinking",
    "written": [
        "Q16. 「過去に損した判断」とその理由を書いてください",
        "Q17. 「長期的に利益がある選択」とは何か説明してください",
        "Q18. 「今の自分が無駄にしているもの」を書いてください（時間・金・人間関係など）",
        "Q19. 「5年後の自分の利益になる行動」を3つ書いてください",
        "Q20. 「感情で判断して失敗した経験」を書いてください",
        "Q21. 「センスがある人」の特徴を説明してください"
    ],
    "writtenFormat": "qa",
    "writtenRule": "any"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
