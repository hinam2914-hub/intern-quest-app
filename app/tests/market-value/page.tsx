"use client";
// 市場価値認識テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "market_value",
    "title": "市場価値認識テスト",
    "path": "/tests/market-value",
    "written": [
        {
            "id": 16,
            "q": "企業が学生を選ぶ理由を、自分の言葉で説明してください"
        },
        {
            "id": 17,
            "q": "「企業に選ばれる人」の特徴を書いてください"
        },
        {
            "id": 18,
            "q": "今の自分が企業側から見て弱いと思う点を書いてください"
        },
        {
            "id": 19,
            "q": "企業が\"お金を払ってでも欲しい人材\"とはどんな人か説明してください"
        },
        {
            "id": 20,
            "q": "「学生気分」と「社会人思考」の違いを書いてください"
        },
        {
            "id": 21,
            "q": "今の自分が\"選ばれる側\"になるために必要な行動を書いてください"
        }
    ],
    "writtenFormat": "idmap",
    "writtenRule": "min10"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
