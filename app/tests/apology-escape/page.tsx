"use client";
// 謝罪逃避・責任転嫁防止テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "apology_escape",
    "title": "謝罪逃避・責任転嫁防止テスト",
    "path": "/tests/apology-escape",
    "written": [
        "Q16. 最近\"謝って終わった\"と思う経験を書いてください",
        "Q17. 「謝罪だけで終わる人」の特徴を書いてください",
        "Q18. 同じミスを防ぐために必要なことを書いてください",
        "Q19. 最近受けた指摘と、その改善策を書いてください",
        "Q20. 「信頼される人」の特徴を書いてください",
        "Q21. 今の自分が\"言葉だけになっている部分\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
