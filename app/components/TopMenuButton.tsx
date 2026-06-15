"use client";
import Link from "next/link";
export default function TopMenuButton() {
    return (
        <Link href="/menu" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "#9ca3af",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 16,
        }}>
            ☰ メニューに戻る
        </Link>
    );
}
