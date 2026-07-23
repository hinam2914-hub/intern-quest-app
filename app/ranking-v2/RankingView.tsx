"use client";

/* ============================================================================
   Intern Quest / ランキング表示コンポーネント（表示専用）
   - データ取得は page.tsx 側で従来通り実施し、結果を props で受け取ります
   - このファイルにはSupabaseアクセスを一切書きません
   配置先: app/ranking-v2/RankingView.tsx
============================================================================ */

/* --------------------------- シーズン設定（手動更新） ---------------------------
   全員共通の内容なのでここで管理します。シーズン切替時はこの3行を書き換えてください。
--------------------------------------------------------------------------- */
const SEASON = {
  name: "SUMMER SEASON",
  endDate: "2026-08-31", // シーズン終了日（YYYY-MM-DD）
  rewards: [
    { rank: "1位", icon: "🏆", point: "5,000pt", items: ["限定称号", "限定バッジ", "Amazonギフト券"] },
    { rank: "2位", icon: "🥈", point: "3,000pt", items: ["限定称号", "限定バッジ"] },
    { rank: "3位", icon: "🥉", point: "1,000pt", items: ["限定称号", "限定バッジ"] },
  ],
};

/* ------------------------------ タブ定義 ------------------------------
   既存 page.tsx のタブをそのまま移設しています。key は変更しないでください。
---------------------------------------------------------------------- */
export const RANKING_TABS = [
  { key: "total", icon: "🏆", label: "総合" },
  { key: "weekly", icon: "⚡", label: "今週" },
  { key: "teams", icon: "👥", label: "チーム" },
  { key: "streak", icon: "🔥", label: "連続" },
  { key: "sankyu", icon: "💌", label: "サンキュー受信" },
  { key: "sankyu_sent", icon: "🎉", label: "サンキュー送信" },
  { key: "challenge", icon: "🎯", label: "チャレンジ" },
  { key: "test", icon: "📚", label: "テスト" },
  { key: "advice", icon: "💡", label: "アドバイス送信" },
  { key: "learn", icon: "📖", label: "学習" },
  { key: "work", icon: "💼", label: "仕事完遂" },
  { key: "kpi", icon: "📊", label: "KPI" },
  { key: "sales_month", icon: "💰", label: "販売(今月)" },
  { key: "sales_total", icon: "🏦", label: "販売(累計)" },
  { key: "maru_total", icon: "☀️", label: "スケジュール" },
  { key: "job_rank", icon: "🎓", label: "就活ランク" },
  { key: "pay_forward", icon: "🤝", label: "ペイフォワード" },
  { key: "thinking", icon: "🧠", label: "思考クエスト" },
  { key: "question", icon: "❓", label: "質問" },
  { key: "ippon", icon: "🎤", label: "IPPON" },
];

/* ------------------------------ カラー ------------------------------ */
const C = {
  purple: "#8b5cf6",
  purpleLt: "#a78bfa",
  green: "#34d399",
  amber: "#f59e0b",
  cyan: "#22d3ee",
  gold: "#ffd700",
  silver: "#cbd5e1",
  bronze: "#f0885a",
  card: "rgba(18,15,45,.78)",
  line: "rgba(139,92,246,.18)",
  lineSoft: "rgba(148,163,184,.12)",
  text: "#e8e6f5",
  sub: "#9c98c4",
  dim: "#6f6b96",
};

const FONT =
  '"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, -apple-system, sans-serif';

/* ------------------------------ 型 ------------------------------ */
export type RankingUser = {
  id: string;
  name: string;
  points: number;
  avatar_url?: string | null;
  color?: string | null;
  subLabel?: string;
  isTeam?: boolean;
};

type Props = {
  activeTab: string;
  onTabChange: (key: string) => void;
  list: RankingUser[];
  weeklyList: RankingUser[];
  myId: string;
  loading: boolean;
  formatPoints: (user: RankingUser) => string;
  onQuest: () => void;
};

/* ------------------------------ 補助 ------------------------------ */
function daysLeft(endDate: string): number {
  const end = new Date(endDate + "T23:59:59+09:00").getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

function Bar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 99,
        background: "rgba(255,255,255,.07)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: "100%",
          borderRadius: 99,
          background: color,
          boxShadow: `0 0 12px ${color}88`,
          transition: "width .8s cubic-bezier(.2,.8,.2,1)",
        }}
      />
    </div>
  );
}

function Avatar({ user, size }: { user: RankingUser; size: number }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,.14)",
          background: "#141230",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 800,
        color: "#fff",
        background: user.color || "linear-gradient(135deg,#4c3a86,#2a2350)",
        border: "1px solid rgba(255,255,255,.14)",
      }}
    >
      {user.name.charAt(0)}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 20,
        boxShadow: "0 18px 44px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon, text }: { icon?: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, color: C.purpleLt }}>
        {text}
      </span>
    </div>
  );
}

/* ============================== 本体 ============================== */
export default function RankingView({
  activeTab,
  onTabChange,
  list,
  weeklyList,
  myId,
  loading,
  formatPoints,
  onQuest,
}: Props) {
  const myIndex = list.findIndex((u) => u.id === myId);
  const me = myIndex >= 0 ? list[myIndex] : null;
  const myRank = myIndex + 1;
  const top3 = list.slice(0, 3);
  const third = list[2];
  const gapToTop3 = me && third && myRank > 3 ? third.points - me.points + 1 : 0;
  const weeklyPointOf = (id: string) => weeklyList.find((u) => u.id === id)?.points ?? 0;
  const myWeekly = weeklyPointOf(myId);
  const left = daysLeft(SEASON.endDate);
  const currentTab = RANKING_TABS.find((t) => t.key === activeTab);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 620px at 18% -8%, rgba(139,92,246,.16), transparent 60%)," +
          "radial-gradient(900px 520px at 88% 4%, rgba(34,211,238,.09), transparent 62%)," +
          "linear-gradient(180deg, #0c0a1e 0%, #08081a 48%, #050511 100%)",
        color: C.text,
        fontFamily: FONT,
        padding: "22px 14px 70px",
        boxSizing: "border-box",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes iqFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
            @keyframes iqGlow { 0%,100%{opacity:.55} 50%{opacity:1} }
            @keyframes iqShine { 0%{transform:translateX(-120%)} 100%{transform:translateX(220%)} }
            .iq-scroll::-webkit-scrollbar { height:6px; width:6px }
            .iq-scroll::-webkit-scrollbar-thumb { background:rgba(139,92,246,.4); border-radius:99px }
            .iq-scroll::-webkit-scrollbar-track { background:transparent }
            .iq-row:hover { background:rgba(139,92,246,.09) !important }
            .iq-grid { display:grid; grid-template-columns:1fr; gap:16px }
            .iq-side { display:grid; grid-template-columns:1fr; gap:16px; align-items:start }
            .iq-tiles { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px }
            .iq-mini { display:grid; grid-template-columns:1fr; gap:12px }
            @media (min-width: 861px) {
              .iq-grid { grid-template-columns:1fr 1.06fr }
              .iq-side { grid-template-columns:1.5fr 1fr }
              .iq-tiles { grid-template-columns:repeat(5,minmax(0,1fr)) }
              .iq-mini { grid-template-columns:1fr 1fr }
            }
            @media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important } }
          `,
        }}
      />

      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* ---------------------------- ヘッダー ---------------------------- */}
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 800, color: C.purpleLt }}>
              INTERN QUEST
            </div>
            <h1
              style={{
                margin: "6px 0 0",
                fontSize: 28,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                gap: 10,
                textShadow: "0 0 24px rgba(139,92,246,.4)",
              }}
            >
              <span style={{ animation: "iqFloat 3.6s ease-in-out infinite" }}>🏆</span>
              ランキング
            </h1>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(245,158,11,.16), rgba(139,92,246,.14))",
              border: "1px solid rgba(245,158,11,.35)",
              boxShadow: "0 0 26px rgba(245,158,11,.16)",
            }}
          >
            <span style={{ fontSize: 20, animation: "iqGlow 2.8s ease-in-out infinite" }}>☀️</span>
            <div style={{ lineHeight: 1.35 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.amber, letterSpacing: 0.6 }}>
                {SEASON.name}
              </div>
              <div style={{ fontSize: 12, color: C.sub }}>
                残り <b style={{ color: C.text, fontSize: 14 }}>{left}</b> 日
              </div>
            </div>
          </div>
        </header>

        {/* ---------------------------- タブ ---------------------------- */}
        <div
          className="iq-scroll"
          style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 16 }}
        >
          {RANKING_TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  fontFamily: FONT,
                  color: active ? "#fff" : C.sub,
                  background: active
                    ? "linear-gradient(135deg, rgba(139,92,246,.85), rgba(109,72,216,.7))"
                    : "rgba(255,255,255,.03)",
                  border: active
                    ? "1px solid rgba(167,139,250,.85)"
                    : "1px solid rgba(255,255,255,.06)",
                  boxShadow: active ? "0 0 22px rgba(139,92,246,.55)" : "none",
                  whiteSpace: "nowrap",
                  transition: "all .2s",
                }}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <Card style={{ padding: 60, textAlign: "center", color: C.sub, fontSize: 14 }}>
            ランキングを読み込んでいます…
          </Card>
        ) : (
          <>
            {/* ------------------ YOUR STATUS / TOP3 ------------------ */}
            <div className="iq-grid" style={{ marginBottom: 16 }}>
              {/* YOUR STATUS */}
              <Card style={{ padding: 20 }}>
                <SectionTitle text="YOUR STATUS" />

                {me ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: 12,
                        margin: "14px 0 12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 58,
                          fontWeight: 900,
                          lineHeight: 1,
                          color: "#fff",
                          textShadow: "0 0 30px rgba(139,92,246,.5)",
                        }}
                      >
                        {myRank}
                        <span style={{ fontSize: 24 }}>位</span>
                      </div>

                      <div style={{ textAlign: "right", minWidth: 180, flex: 1 }}>
                        <div style={{ fontSize: 28, fontWeight: 900 }}>{formatPoints(me)}</div>
                        {myRank > 3 && gapToTop3 > 0 && (
                          <>
                            <div style={{ fontSize: 12, color: C.sub, margin: "4px 0 7px" }}>
                              TOP3まであと{" "}
                              <b style={{ color: C.amber }}>{gapToTop3.toLocaleString()}pt</b>
                            </div>
                            <Bar
                              pct={third ? (me.points / third.points) * 100 : 0}
                              color={C.purple}
                            />
                          </>
                        )}
                        {myRank <= 3 && (
                          <div style={{ fontSize: 12, color: C.gold, marginTop: 6 }}>
                            TOP3をキープ中です
                          </div>
                        )}
                      </div>
                    </div>

                    {myRank > 3 && third && (
                      <div
                        style={{
                          padding: "11px 14px",
                          borderRadius: 13,
                          background: "rgba(139,92,246,.10)",
                          border: "1px solid rgba(139,92,246,.32)",
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 12,
                        }}
                      >
                        次の目標：<span style={{ color: C.purpleLt }}>{third.name}</span>
                        を抜いて3位になる！
                      </div>
                    )}

                    <div className="iq-mini" style={{ marginBottom: 12 }}>
                      <div style={miniCard}>
                        <div style={miniLabel}>今週獲得ポイント</div>
                        <div
                          style={{ fontSize: 24, fontWeight: 900, color: C.green, marginTop: 4 }}
                        >
                          +{myWeekly.toLocaleString()} <span style={{ fontSize: 13 }}>pt</span>
                        </div>
                      </div>
                      <div style={miniCard}>
                        <div style={miniLabel}>
                          {currentTab ? `${currentTab.icon} ${currentTab.label}での順位` : "順位"}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>
                          {myRank}
                          <span style={{ fontSize: 13, color: C.sub }}> / {list.length}位</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "28px 0", textAlign: "center", color: C.dim, fontSize: 13 }}>
                    このランキングにはまだ参加記録がありません
                  </div>
                )}
              </Card>

              {/* TOP 3 PLAYERS */}
              <Card
                style={{
                  padding: 20,
                  position: "relative",
                  overflow: "hidden",
                  background:
                    "radial-gradient(520px 300px at 50% 8%, rgba(245,158,11,.13), transparent 62%), " +
                    C.card,
                }}
              >
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <span
                    style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2.4, color: C.purpleLt }}
                  >
                    TOP 3 PLAYERS
                  </span>
                </div>

                {top3.length >= 3 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1.18fr 1fr",
                      alignItems: "end",
                      gap: 8,
                    }}
                  >
                    <Podium user={top3[1]} place={2} weekly={weeklyPointOf(top3[1].id)} fmt={formatPoints} />
                    <Podium user={top3[0]} place={1} weekly={weeklyPointOf(top3[0].id)} fmt={formatPoints} />
                    <Podium user={top3[2]} place={3} weekly={weeklyPointOf(top3[2].id)} fmt={formatPoints} />
                  </div>
                ) : (
                  <div style={{ padding: "40px 0", textAlign: "center", color: C.dim, fontSize: 13 }}>
                    データがまだ3件に達していません
                  </div>
                )}
              </Card>
            </div>

            {/* ------------------ CATEGORY RANKING ------------------ */}
            <Card style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ marginBottom: 14 }}>
                <SectionTitle text="CATEGORY RANKING" />
              </div>
              <div className="iq-tiles">
                {RANKING_TABS.map((t) => {
                  const active = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => onTabChange(t.key)}
                      style={{
                        padding: "14px 4px",
                        borderRadius: 15,
                        cursor: "pointer",
                        fontFamily: FONT,
                        background: active ? "rgba(139,92,246,.14)" : "rgba(255,255,255,.02)",
                        border: active
                          ? "1px solid rgba(167,139,250,.7)"
                          : "1px solid rgba(255,255,255,.06)",
                        boxShadow: active ? "0 0 22px rgba(139,92,246,.35)" : "none",
                        color: active ? "#fff" : C.sub,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                        transition: "all .2s",
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{t.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, textAlign: "center" }}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* ------------------ ランキング一覧 / サイド ------------------ */}
            <div className="iq-side">
              <Card style={{ padding: 20 }}>
                <div style={{ marginBottom: 12 }}>
                  <SectionTitle
                    text={`${currentTab ? currentTab.label.toUpperCase() : "ALL"} RANKING`}
                  />
                </div>

                {list.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: C.dim, fontSize: 13 }}>
                    このランキングにはまだデータがありません
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {list.map((u, i) => (
                      <Row
                        key={u.id}
                        user={u}
                        rank={i + 1}
                        isMe={u.id === myId}
                        fmt={formatPoints}
                      />
                    ))}
                  </div>
                )}
              </Card>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* NEXT TARGET */}
                {me && myRank > 1 && (
                  <Card style={{ padding: 20 }}>
                    <SectionTitle icon="🎯" text="NEXT TARGET" />
                    {(() => {
                      const target = list[myIndex - 1];
                      const need = target.points - me.points + 1;
                      return (
                        <>
                          <div
                            style={{
                              textAlign: "center",
                              margin: "14px 0 16px",
                              fontSize: 15,
                              fontWeight: 700,
                            }}
                          >
                            {target.name}を抜いて
                            <br />
                            <span style={{ fontSize: 22, fontWeight: 900, color: C.amber }}>
                              {myRank - 1}位になる！
                            </span>
                          </div>
                          <div
                            style={{
                              padding: 14,
                              borderRadius: 15,
                              background: "rgba(245,158,11,.07)",
                              border: "1px solid rgba(245,158,11,.24)",
                              marginBottom: 14,
                            }}
                          >
                            <div style={{ fontSize: 11, color: C.sub }}>必要ポイント</div>
                            <div
                              style={{
                                fontSize: 32,
                                fontWeight: 900,
                                color: C.gold,
                                lineHeight: 1.2,
                                textShadow: `0 0 22px ${C.gold}55`,
                              }}
                            >
                              {need.toLocaleString()} <span style={{ fontSize: 14 }}>pt</span>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <Bar
                                pct={(me.points / target.points) * 100}
                                color={C.gold}
                                height={7}
                              />
                            </div>
                          </div>
                          <button onClick={onQuest} style={ctaBtn}>
                            クエストを確認する →
                          </button>
                        </>
                      );
                    })()}
                  </Card>
                )}

                {/* シーズン報酬 */}
                <Card style={{ padding: 20 }}>
                  <SectionTitle icon="🎁" text="シーズン報酬" />
                  <div style={{ fontSize: 12, color: C.sub, margin: "10px 0 12px" }}>
                    TOP3入賞で豪華報酬！
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {SEASON.rewards.map((r, i) => (
                      <div
                        key={r.rank}
                        style={{
                          padding: "11px 9px",
                          borderRadius: 13,
                          background: i === 0 ? "rgba(255,215,0,.07)" : "rgba(255,255,255,.025)",
                          border: `1px solid ${i === 0 ? "rgba(255,215,0,.35)" : C.lineSoft}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: i === 0 ? C.gold : i === 1 ? C.silver : C.bronze,
                            marginBottom: 7,
                          }}
                        >
                          <span>{r.icon}</span>
                          {r.rank}
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 900,
                            color: i === 0 ? C.gold : C.text,
                            marginBottom: 7,
                          }}
                        >
                          {r.point}
                        </div>
                        {r.items.map((it) => (
                          <div key={it} style={{ fontSize: 10, color: C.dim, lineHeight: 1.7 }}>
                            {it}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        <p style={{ fontSize: 11, color: C.dim, marginTop: 18, textAlign: "center" }}>
          ※ ポイントの反映には最大10分程度かかる場合があります。
        </p>
      </div>
    </div>
  );
}

/* ---------------------------- 表彰台 ---------------------------- */
function Podium({
  user,
  place,
  weekly,
  fmt,
}: {
  user: RankingUser;
  place: 1 | 2 | 3;
  weekly: number;
  fmt: (u: RankingUser) => string;
}) {
  const first = place === 1;
  const tone = place === 1 ? C.gold : place === 2 ? C.silver : C.bronze;
  const height = place === 1 ? 70 : place === 2 ? 48 : 40;

  return (
    <div style={{ textAlign: "center" }}>
      {first && (
        <div
          style={{
            fontSize: 24,
            marginBottom: -4,
            animation: "iqFloat 3s ease-in-out infinite",
            filter: `drop-shadow(0 0 10px ${C.gold})`,
          }}
        >
          👑
        </div>
      )}

      <div
        style={{
          position: "relative",
          padding: first ? "16px 10px 12px" : "14px 8px 12px",
          borderRadius: "18px 18px 0 0",
          background: first
            ? "linear-gradient(180deg, rgba(255,215,0,.16), rgba(18,15,45,.9))"
            : "linear-gradient(180deg, rgba(255,255,255,.05), rgba(18,15,45,.85))",
          border: `1px solid ${first ? "rgba(255,215,0,.55)" : "rgba(255,255,255,.12)"}`,
          borderBottom: "none",
          boxShadow: first ? `0 0 40px ${C.gold}33` : "none",
          overflow: "hidden",
        }}
      >
        {first && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "38%",
              height: "100%",
              background: "linear-gradient(105deg, transparent, rgba(255,255,255,.16), transparent)",
              animation: "iqShine 3.6s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            marginBottom: 9,
          }}
        >
          {first && <span style={{ fontSize: 20 }}>🌿</span>}
          <div
            style={{
              borderRadius: "50%",
              padding: 3,
              background: first
                ? `linear-gradient(135deg, ${C.gold}, #b8860b)`
                : `linear-gradient(135deg, ${tone}, rgba(255,255,255,.15))`,
              boxShadow: first ? `0 0 26px ${C.gold}77` : "none",
            }}
          >
            <Avatar user={user} size={first ? 64 : 50} />
          </div>
          {first && <span style={{ fontSize: 20, transform: "scaleX(-1)" }}>🌿</span>}
        </div>

        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>{user.name}</div>
        <div
          style={{
            fontSize: first ? 19 : 16,
            fontWeight: 900,
            color: tone,
            textShadow: first ? `0 0 20px ${C.gold}66` : "none",
          }}
        >
          {fmt(user)}
        </div>

        {weekly > 0 && (
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>
            今週 <b style={{ color: C.green }}>+{weekly.toLocaleString()}pt</b>
          </div>
        )}
        {user.subLabel && (
          <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{user.subLabel}</div>
        )}

        {first && (
          <div
            style={{
              marginTop: 9,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.2,
              color: C.gold,
              padding: "5px 0",
              borderTop: `1px solid ${C.gold}44`,
            }}
          >
            LEGEND PLAYER
          </div>
        )}
      </div>

      <div
        style={{
          height,
          borderRadius: "0 0 14px 14px",
          background: first
            ? "linear-gradient(180deg, rgba(255,215,0,.22), rgba(120,85,10,.28))"
            : "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02))",
          border: `1px solid ${first ? "rgba(255,215,0,.42)" : "rgba(255,255,255,.09)"}`,
          borderTop: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: first ? 32 : 24,
          fontWeight: 900,
          color: tone,
          opacity: first ? 1 : 0.55,
          textShadow: first ? `0 0 22px ${C.gold}88` : "none",
        }}
      >
        {place}
      </div>
    </div>
  );
}

/* ---------------------------- 一覧の行 ---------------------------- */
function Row({
  user,
  rank,
  isMe,
  fmt,
}: {
  user: RankingUser;
  rank: number;
  isMe: boolean;
  fmt: (u: RankingUser) => string;
}) {
  const medal = rank <= 3;
  const tone = rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : C.dim;

  return (
    <div
      className="iq-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "11px 12px",
        borderRadius: 14,
        background: isMe ? "rgba(139,92,246,.16)" : "rgba(255,255,255,.017)",
        border: isMe ? "1px solid rgba(167,139,250,.6)" : `1px solid ${C.lineSoft}`,
        boxShadow: isMe ? "0 0 26px rgba(139,92,246,.32)" : "none",
        transition: "background .2s",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: medal ? "50%" : 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 900,
          color: medal ? tone : C.sub,
          border: medal ? `1.5px solid ${tone}` : "none",
          background: medal ? `${tone}14` : "transparent",
          boxShadow: medal ? `0 0 14px ${tone}44` : "none",
        }}
      >
        {rank}
      </div>

      <Avatar user={user} size={36} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{user.name}</span>
          {rank === 1 && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                padding: "2px 7px",
                borderRadius: 6,
                color: "#3a2c00",
                background: `linear-gradient(135deg, ${C.gold}, #e0a800)`,
              }}
            >
              LEGEND
            </span>
          )}
          {isMe && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                padding: "2px 7px",
                borderRadius: 6,
                color: "#fff",
                background: `linear-gradient(135deg, ${C.purpleLt}, ${C.purple})`,
                boxShadow: `0 0 12px ${C.purple}88`,
              }}
            >
              YOU
            </span>
          )}
        </div>
        {user.subLabel && (
          <div style={{ fontSize: 10.5, color: C.dim, marginTop: 2 }}>{user.subLabel}</div>
        )}
      </div>

      <div style={{ fontSize: 15, fontWeight: 900, textAlign: "right", whiteSpace: "nowrap" }}>
        {fmt(user)}
      </div>
    </div>
  );
}

/* ---------------------------- スタイル片 ---------------------------- */
const miniCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 15,
  background: "rgba(255,255,255,.022)",
  border: "1px solid rgba(255,255,255,.06)",
};

const miniLabel: React.CSSProperties = {
  fontSize: 11,
  color: C.sub,
  letterSpacing: 0.4,
};

const ctaBtn: React.CSSProperties = {
  width: "100%",
  padding: "13px 0",
  borderRadius: 14,
  fontSize: 13.5,
  fontWeight: 800,
  fontFamily: FONT,
  color: "#fff",
  background: "linear-gradient(135deg, rgba(245,158,11,.28), rgba(139,92,246,.3))",
  border: "1px solid rgba(245,158,11,.5)",
  boxShadow: "0 0 26px rgba(245,158,11,.22)",
  cursor: "pointer",
};
