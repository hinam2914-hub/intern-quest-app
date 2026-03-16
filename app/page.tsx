export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Intern Quest MVP</h1>
      <p>デプロイ成功。ここから作っていく。</p>

      <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <a href="/login">ログイン画面へ</a>
        <a href="/mypage">マイページへ</a>
        <a href="/ranking">ランキングへ</a>
        <a href="/report">日報ページへ</a>
      </div>
    </main>
  );
}