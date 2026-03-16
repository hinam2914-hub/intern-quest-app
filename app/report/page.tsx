"use client";

import { useState } from "react";

export default function ReportPage() {
    const [report, setReport] = useState("");
    const [message, setMessage] = useState("");

    const submitReport = () => {
        if (!report) {
            setMessage("日報を書いてください");
            return;
        }

        const today = new Date().toLocaleDateString();
        const lastReportDate = localStorage.getItem("lastReportDate");

        if (lastReportDate === today) {
            setMessage("今日はもう日報提出済みです");
            return;
        }

        const savedPoints = localStorage.getItem("myPoints");
        const currentPoints = savedPoints ? Number(savedPoints) : 0;
        const newPoints = currentPoints + 10;

        localStorage.setItem("myPoints", String(newPoints));
        localStorage.setItem("lastReportDate", today);

        setMessage("日報提出完了 +10pt");
        setReport("");
    };

    return (
        <main>
            <h1>日報</h1>

            <textarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
                placeholder="今日やったことを書く"
                rows={6}
                cols={40}
            />

            <div>
                <button onClick={submitReport}>提出</button>
            </div>

            <p>{message}</p>
        </main>
    );
}