"use client";
// 社会人基準・現実認識。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "social_standard",
    "title": "社会人基準・現実認識",
    "path": "/tests/social-standard",
    "written": [
        "Q16. 「社会人として今の自分に足りないもの」を3つ書いてください",
        "Q17. 「自分は普通以上だ」と思っていた部分を書いてください。また、それは本当に社会基準で見ても強みか説明してください",
        "Q18. 今の自分が「できてるつもり」になっていることを書いてください",
        "Q19. 5年後に周りと差がつくと思う習慣を書いてください",
        "Q20. 「社会で通用する人」と「通用しない人」の違いを書いてください",
        "Q21. 今の自分が最優先で改善すべきことを書いてください"
    ],
    "writtenFormat": "qa",
    "writtenRule": "any"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
