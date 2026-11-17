"use client";
// 基準上昇・人生現実テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "standard_raising",
    "title": "基準上昇・人生現実テスト",
    "path": "/tests/standard-raising",
    "written": [
        "Q16. 今の自分が\"基準低い\"と思う部分を書いてください",
        "Q17. 親世代と同じ生活をするために必要だと思うことを書いてください",
        "Q18. 5年後に差がつくと思う日常習慣を書いてください",
        "Q19. 「基準が高い人」の特徴を書いてください",
        "Q20. 今の自分が\"楽に流されている部分\"を書いてください",
        "Q21. 今後、自分が上げていきたい基準を3つ書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
