export default function DotKun({ size = 40, stage = 2 }: { size?: number; stage?: number }) {
  return (
    <svg width={size} height={size} viewBox="165 110 350 285" xmlns="http://www.w3.org/2000/svg">
      {/* 王者：オーラ（一番後ろ） */}
      {stage >= 3 && <circle cx="340" cy="235" r="160" fill="#fbbf24" opacity="0.18" />}

      {/* アンテナの点（通常以上） */}
      {stage >= 2 && <circle cx="248" cy="150" r="13" fill="#a5b4fc" />}
      {stage >= 2 && <circle cx="432" cy="150" r="13" fill="#a5b4fc" />}

      {/* 体 */}
      <circle cx="340" cy="230" r="135" fill="#6366f1" />
      <ellipse cx="340" cy="285" rx="92" ry="78" fill="#eef2ff" />

      {/* 目 */}
      <circle cx="298" cy="210" r="30" fill="#ffffff" />
      <circle cx="382" cy="210" r="30" fill="#ffffff" />
      <circle cx="303" cy="214" r="15" fill="#1e1b4b" />
      <circle cx="387" cy="214" r="15" fill="#1e1b4b" />
      <circle cx="309" cy="209" r="5" fill="#ffffff" />
      <circle cx="393" cy="209" r="5" fill="#ffffff" />

      {/* ほっぺ（ベビーは大きめ） */}
      <ellipse cx="262" cy="252" rx={stage === 1 ? 22 : 17} ry={stage === 1 ? 14 : 11} fill="#fb7185" opacity="0.55" />
      <ellipse cx="418" cy="252" rx={stage === 1 ? 22 : 17} ry={stage === 1 ? 14 : 11} fill="#fb7185" opacity="0.55" />

      {/* 口 */}
      <path d="M312 258 Q340 286 368 258" fill="none" stroke="#1e1b4b" strokeWidth="5" strokeLinecap="round" />

      {/* 手（通常以上で出す。ベビーは手なし） */}
      {stage >= 2 && <circle cx="200" cy="262" r="26" fill="#6366f1" />}
      {stage >= 2 && <circle cx="480" cy="262" r="26" fill="#6366f1" />}
      {stage >= 2 && <path d="M474 240 Q500 224 512 244" fill="none" stroke="#6366f1" strokeWidth="14" strokeLinecap="round" />}

      {/* 王者：王冠 */}
      {stage >= 3 && (
        <g>
          <path d="M285 130 L305 100 L340 122 L375 100 L395 130 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="3" />
          <circle cx="305" cy="100" r="7" fill="#fde68a" />
          <circle cx="340" cy="122" r="7" fill="#fde68a" />
          <circle cx="375" cy="100" r="7" fill="#fde68a" />
          <rect x="285" y="128" width="110" height="10" rx="3" fill="#f59e0b" />
        </g>
      )}
    </svg>
  );
}
