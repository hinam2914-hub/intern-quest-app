"use client";

import Link from "next/link";

export default function BackToMenuButton() {
    return (
        <div className="flex justify-center mt-12 mb-8">
            <Link
                href="/menu"
                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-lg"
            >
                メニューへ戻る
            </Link>
        </div>
    );
}