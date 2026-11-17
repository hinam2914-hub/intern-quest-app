"use client";
// 本質思考・タスク整理。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "essence_thinking",
    "title": "本質思考・タスク整理",
    "path": "/tests/essence-thinking",
    "written": [
        "Q16. 今の自分が無駄にやっていることを書いてください",
        "Q17. やらなくていい仕事の特徴を書いてください",
        "Q18. 自分が忙しいだけになっている部分を書いてください",
        "Q19. 今の自分の成果に最も直結する行動を3つ書いてください",
        "Q20. 余計なことを減らすメリットを説明してください",
        "Q21. 今後やらないことを3つ決めてください"
    ],
    "writtenFormat": "qa",
    "writtenRule": "any"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
