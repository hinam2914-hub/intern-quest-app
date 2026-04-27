"use client";

import Link from "next/link";

type Props = {
    title: string;
    description?: string;
    emoji?: string;
};

export default function PageHeader({ title, description, emoji }: Props) {
    return (
        <div className="mb-8">
            <Link
                href="/mypage"
                className="inline-block text-sm font-bold tracking-widest text-blue-400 hover:text-blue-300 mb-3"
            >
                INTERN QUEST
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2">
                {emoji && <span className="mr-2">{emoji}</span>}
                {title}
            </h1>
            {description && <p className="text-gray-400 text-sm">{description}</p>}
        </div>
    );
}