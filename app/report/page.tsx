"use client";

import { useState } from "react";

export default function ReportPage() {
    const [text, setText] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = () => {
        if (!text) {
            setMessage("日報を書いてください");
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const lastSubmit = localStorage.getItem("lastReportDate");

        if (lastSubmit === today) {
            setMessage("今日はすでに提出済みです");
            return;
        }

        const currentPoints = Number(localStorage.getItem("myPoints") || "0");
        const newPoints = currentPoints + 20;

        localStorage.setItem("myPoints", String(newPoints));
        localStorage.setItem("lastReportDate", today);

        setMessage("日報提出完了！ +20pt");
        setText("");
    };

    return (
        <main>
            <h1>日報</h1>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="今日やったことを書く"
                rows={6}
                cols={40}
            />

            <div>
                <button onClick={handleSubmit}>提出</button>
            </div>

            <p>{message}</p>

            <div style={{ marginTop: 20 }}>
                <a href="/mypage">マイページへ戻る</a>
            </div>
        </main>
    );
}