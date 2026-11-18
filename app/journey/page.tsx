"use client";
// 冒険マップは SKILL WORLD の地図に統合した。このURLに来た人は、地図上の「今いるSTEP」へ案内する
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JourneyPage() {
    const router = useRouter();
    useEffect(() => { router.replace("/skill-board?journey=1"); }, [router]);
    return <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#8fd3ff,#e6f6ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e3a5f", fontWeight: 800 }}>🗺️ 冒険マップを開いています...</main>;
}
