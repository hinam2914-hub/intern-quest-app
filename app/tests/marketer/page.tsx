"use client";
// マーケター適性テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "marketer",
    "title": "マーケター適性テスト",
    "path": "/tests/marketer",
    "written": [
        "「なぜ営業経験がマーケに必要か」を説明してください",
        "「売れない原因」を3つに分解してください",
        "「売れる導線」を具体的に説明してください（例：認知→興味→比較→行動）",
        "「今売っているサービスを売るならどう改善するか」",
        "「1→10に伸ばすためにやること」を書いてください",
        "「自分がマーケターとして不足している点」"
    ],
    "writtenFormat": "list",
    "writtenRule": "none",
    "rank": true
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
