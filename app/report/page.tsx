"use client";

import { useState } from "react";

export default function ReportPage() {
    const [report, setReport] = useState("");
    const [message, setMessage] = useState("");

    const submitReport = () => {
        setMessage("日報を提出しました");
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