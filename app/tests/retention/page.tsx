"use client";
// Dot.A 雇用テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "retention",
    "title": "Dot.A 雇用テスト",
    "path": "/tests/retention",
    "written": [
        "「なぜ自分はDot.Aに残るべきなのか」を書いてください",
        "「この環境で成果を出すためにやること」を具体的に書いてください",
        "「今の自分の課題」とその改善策を書いてください",
        "「辞める人の特徴」と「自分はどう違うか」",
        "「1ヶ月後に成果を出すための行動計画」",
        "「覚悟」を言語化してください"
    ],
    "writtenFormat": "list",
    "writtenRule": "none"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
