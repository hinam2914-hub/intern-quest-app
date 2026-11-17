"use client";
// 起業適性テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "entrepreneur",
    "title": "起業適性テスト",
    "path": "/tests/entrepreneur",
    "written": [
        "「なぜ起業したいのか」を書いてください",
        "「今すぐ売れるものは何か」を具体的に書いてください",
        "「自分が提供できる価値」を説明してください",
        "「今の自分のスキルでお金を生む方法」を書いてください",
        "「起業して失敗する原因」とそれをどう防ぐか",
        "「起業しない場合の人生」と「起業した場合の人生」を比較してください"
    ],
    "writtenFormat": "list",
    "writtenRule": "none",
    "rank": true
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
