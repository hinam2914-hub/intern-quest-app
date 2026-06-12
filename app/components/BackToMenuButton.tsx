"use client";
import Link from "next/link";
export default function BackToMenuButton() {
    return (
        <div style={{ marginTop: 40, display: "flex", justifyContent: "center" }}>
            <Link href="/menu" style={{
                padding: "12px 32px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#9ca3af",
                fontSize: 14,
                cursor: "pointer",
                fontWeight: 600,
                textDecoration: "none",
            }}>
                ☰ メニューに戻る
            </Link>
        </div>
    );
}
