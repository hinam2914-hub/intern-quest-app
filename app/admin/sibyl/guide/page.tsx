"use client";
import { useRouter } from "next/navigation";

const CARD: React.CSSProperties = { background: "rgba(18,16,40,.85)", border: "1px solid rgba(139,92,246,.25)", borderRadius: 18, padding: "24px 26px" };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 900, letterSpacing: 2, color: "#a78bfa", marginBottom: 16 };
const TXT: React.CSSProperties = { fontSize: 13.5, color: "#c7c9dd", lineHeight: 1.9 };

const AXES = [
  { name: "地頭", key: "cog", color: "#6366f1", from: "学歴 × MBTI × 趣味", desc: "論理的に考え、理解する速さ。学歴の影響が最も大きい軸です。" },
  { name: "胆力", key: "grit", color: "#ef4444", from: "MBTI × 学歴 × 部活", desc: "粘り強さ・打たれ強さ。運動部経験が強く効きます。数字を追う仕事で重要。" },
  { name: "対人", key: "social", color: "#10b981", from: "MBTI × 部活 × 趣味", desc: "人と関わる力・場を回す力。営業・人事系の適性に直結します。" },
  { name: "瞬発", key: "drive", color: "#f59e0b", from: "MBTI × 部活 × 趣味", desc: "行動の速さ・アクション量。訪販やクローザーで効いてくる軸です。" },
  { name: "創造", key: "create", color: "#a855f7", from: "MBTI × 趣味", desc: "発想力・企画力。ものづくり系の趣味や直感型MBTIで高くなります。" },
];

const COLORS = [
  { c: "緑", code: "#2E7D5B", type: "外交官タイプ", mbti: "NF系（ENFP・INFJなど）", tag: "意味とつながりで動く", route: "低学歴→訪販／高学歴→テレアポ", goal: "就活アドバイザー・人事として残留", note: "メンターに向く。数字で詰めると静かに離脱するので注意。" },
  { c: "紫", code: "#6A4C9C", type: "分析家タイプ", mbti: "NT系（INTJ・ENTPなど）", tag: "論理と仕組みで動く", route: "テレアポ（低学歴はインフラも）", goal: "AIチーム・戦略管理マネージャー", note: "外向型（E）ならクローザー適性もあり。理由なき命令で冷める。" },
  { c: "青", code: "#2B6CB0", type: "番人タイプ", mbti: "SJ系（ISTJ・ESFJなど）", tag: "秩序と継続で動く", route: "低学歴→訪販／高学歴→管理・マネジメント", goal: "鉄人型の訪販、または管理マネージャー", note: "クローザーは非推奨。曖昧な指示・方針変更が苦手。" },
  { c: "黄", code: "#C99A00", type: "探検家タイプ", mbti: "SP系（ESTP・ISFPなど）", tag: "行動と臨機応変で動く", route: "訪販またはクローザー", goal: "トップクローザー・コミュニティプレジデント", note: "座学より実践。退屈すると熱が冷めるので短期目標を刻む。" },
];

const RANKS = [
  { r: "S", min: "75〜", color: "#a78bfa", label: "非常に高いポテンシャル" },
  { r: "A", min: "60〜74", color: "#34d399", label: "高いポテンシャル" },
  { r: "B", min: "45〜59", color: "#38bdf8", label: "標準的なポテンシャル" },
  { r: "C", min: "30〜44", color: "#fbbf24", label: "育成でカバー可能" },
  { r: "D", min: "〜29", color: "#f87171", label: "重点フォローが必要" },
];

export default function SibylGuidePage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0c0a24, #08081a 60%)", color: "#e5e7eb", padding: "0 0 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderBottom: "1px solid rgba(139,92,246,.2)", position: "sticky", top: 0, background: "rgba(8,8,26,.92)", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 3, color: "#fff" }}>🔮 SIBYL SYSTEM</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#a78bfa", borderLeft: "1px solid rgba(139,92,246,.4)", paddingLeft: 12 }}>GUIDE</span>
        </div>
        <button onClick={() => router.push("/admin")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#9ca3af", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>← 管理画面に戻る</button>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "26px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ ...CARD, background: "linear-gradient(135deg, rgba(49,32,95,.7), rgba(16,14,42,.9))" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 10 }}>シビュラシステムの見方</div>
          <div style={TXT}>
            シビュラは <strong style={{ color: "#c4b5fd" }}>MBTI・学歴・高校の部活・趣味</strong> の4項目から、
            メンバーの資質を5つの軸で数値化し、配属適性や育成方針を導き出す仕組みです。
            <br />
            数値は「現時点の傾向」であり、本人の価値や将来を決めつけるものではありません。
            配置や声かけを考えるときの<strong style={{ color: "#c4b5fd" }}>参考情報</strong>として使ってください。
          </div>
        </div>

        <div style={CARD}>
          <div style={H}>📊 5つの軸</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {AXES.map(a => (
              <div key={a.key} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,.03)", borderLeft: `3px solid ${a.color}` }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 5 }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: a.color }}>{a.name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8b8fa8" }}>元データ: {a.from}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "#c7c9dd", lineHeight: 1.7 }}>{a.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "#8b8fa8", lineHeight: 1.7 }}>
            各軸は最大20点。5軸の合計（最大100）で総合ランクが決まります。
          </div>
        </div>

        <div style={CARD}>
          <div style={H}>🏅 総合ランク</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {RANKS.map(r => (
              <div key={r.r} style={{ padding: "14px 12px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: `1px solid ${r.color}33`, textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: r.color, lineHeight: 1 }}>{r.r}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#c7c9dd", marginTop: 6 }}>合計 {r.min}</div>
                <div style={{ fontSize: 10, color: "#8b8fa8", marginTop: 3 }}>{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={CARD}>
          <div style={H}>🎨 4つの気質（MBTI由来）</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {COLORS.map(c => (
              <div key={c.c} style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: `1px solid ${c.code}55` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: c.code, display: "inline-block" }} />
                  <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{c.type}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8b8fa8" }}>{c.mbti}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "#c4b5fd", fontWeight: 700, marginBottom: 8 }}>{c.tag}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "#c7c9dd" }}><span style={{ color: "#8b8fa8" }}>入口: </span>{c.route}</div>
                  <div style={{ fontSize: 12, color: "#c7c9dd" }}><span style={{ color: "#8b8fa8" }}>最終: </span>{c.goal}</div>
                </div>
                <div style={{ fontSize: 11.5, color: "#fbbf24", lineHeight: 1.7 }}>⚠️ {c.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={CARD}>
          <div style={H}>🧭 主な指標の意味</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {[
              { t: "組織健全度", d: "日報提出率40% + アクティブ率40% + (1−離職リスク率)20% の合成スコア。70%以上が目安。" },
              { t: "配属変更推奨", d: "適性1位の職種が現在の所属と違い、かつスコアが高い人。異動を検討する候補として表示。" },
              { t: "育成優先メンバー", d: "5軸の合計が低い、または極端に低い軸がある人。放置せず個別フォローが必要。" },
              { t: "離職リスク", d: "胆力が低く、直近7日の日報提出がない人。面談の優先度が高い。" },
              { t: "次世代リーダー候補", d: "総合点が高く、特に胆力と対人が両方高い人。権限委譲の候補。" },
            ].map(x => (
              <div key={x.t} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{x.t}</div>
                <div style={{ fontSize: 12.5, color: "#c7c9dd", lineHeight: 1.7 }}>{x.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...CARD, border: "1px solid rgba(251,191,36,.35)" }}>
          <div style={{ ...H, color: "#fbbf24" }}>⚠️ 使うときの注意</div>
          <div style={{ fontSize: 13, color: "#fde8b8", lineHeight: 1.9 }}>
            ・データ未入力の人はスコアが低く出ます。「能力が低い」ではなく<strong>「未診断」</strong>です。<br />
            ・数値は入力データからの推定であり、実際の働きぶりを直接測ったものではありません。<br />
            ・本人に数値をそのまま伝えると意欲を下げることがあります。伝える場合は強みから。<br />
            ・「離職リスク」等の判定は個人情報です。取り扱いには十分注意してください。
          </div>
        </div>
      </div>
    </div>
  );
}
