import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intern Quest",
  description: "成長が可視化されるゲームOS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}