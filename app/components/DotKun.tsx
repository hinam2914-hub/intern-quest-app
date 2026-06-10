type Mood = "normal" | "happy" | "sad" | "cheer";
export default function DotKun({ size = 40, stage = 2, mood = "normal" }: { size?: number; stage?: number; mood?: Mood }) {
  const baseBody = stage === 1 ? "#a5b4fc" : stage === 2 ? "#6366f1" : stage === 3 ? "#5b54e0" : stage === 4 ? "#4f46e5" : "#4338ca";
  const body = mood === "sad" ? "#818cf8" : baseBody;
  return (
    <svg width={size} height={size} viewBox="150 80 400 330" xmlns="http://www.w3.org/2000/svg">
      {stage >= 4 && mood !== "sad" && <circle cx="340" cy="240" r="170" fill="#fbbf24" opacity={stage === 5 ? 0.22 : 0.12} />}
      {stage === 1 && (<g><path d="M340 95 Q330 70 345 60" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round"/><ellipse cx="352" cy="62" rx="11" ry="7" fill="#22c55e"/></g>)}
      {stage >= 2 && <circle cx="248" cy="150" r="13" fill="#a5b4fc" />}
      {stage >= 2 && <circle cx="432" cy="150" r="13" fill="#a5b4fc" />}
      {stage >= 4 && (<g><path d="M250 340 Q210 250 235 175 L255 185 Q240 270 285 350 Z" fill="#7c3aed" opacity="0.85"/><path d="M430 340 Q470 250 445 175 L425 185 Q440 270 395 350 Z" fill="#7c3aed" opacity="0.85"/></g>)}
      <circle cx="340" cy="230" r="135" fill={body} />
      <ellipse cx="340" cy="285" rx="92" ry="78" fill="#eef2ff" />
      {mood === "normal" && (<g>
        <circle cx="298" cy="210" r="30" fill="#ffffff" /><circle cx="382" cy="210" r="30" fill="#ffffff" />
        <circle cx="303" cy="214" r="15" fill="#1e1b4b" /><circle cx="387" cy="214" r="15" fill="#1e1b4b" />
        <circle cx="309" cy="209" r="5" fill="#ffffff" /><circle cx="393" cy="209" r="5" fill="#ffffff" />
      </g>)}
      {mood === "happy" && (<g>
        <path d="M283 212 Q298 188 313 212" fill="none" stroke="#1e1b4b" strokeWidth="7" strokeLinecap="round"/>
        <path d="M367 212 Q382 188 397 212" fill="none" stroke="#1e1b4b" strokeWidth="7" strokeLinecap="round"/>
      </g>)}
      {mood === "sad" && (<g>
        <path d="M275 212 Q298 222 321 212" fill="none" stroke="#1e1b4b" strokeWidth="6" strokeLinecap="round"/>
        <path d="M359 212 Q382 222 405 212" fill="none" stroke="#1e1b4b" strokeWidth="6" strokeLinecap="round"/>
        <path d="M292 222 Q284 270 296 300 Q308 270 300 222 Z" fill="#38bdf8" opacity="0.85"/>
        <path d="M388 222 Q380 270 392 300 Q404 270 396 222 Z" fill="#38bdf8" opacity="0.85"/>
        <ellipse cx="296" cy="312" rx="11" ry="8" fill="#38bdf8" opacity="0.7"/>
        <ellipse cx="392" cy="312" rx="11" ry="8" fill="#38bdf8" opacity="0.7"/>
      </g>)}
      {mood === "cheer" && (<g>
        <path d="M282 214 Q298 200 314 206" fill="none" stroke="#1e1b4b" strokeWidth="7" strokeLinecap="round"/>
        <path d="M366 206 Q382 200 398 214" fill="none" stroke="#1e1b4b" strokeWidth="7" strokeLinecap="round"/>
      </g>)}
      <ellipse cx="262" cy={mood === "sad" ? 256 : 253} rx={stage === 1 ? 22 : 17} ry={stage === 1 ? 14 : 11} fill="#fb7185" opacity="0.55" />
      <ellipse cx="418" cy={mood === "sad" ? 256 : 253} rx={stage === 1 ? 22 : 17} ry={stage === 1 ? 14 : 11} fill="#fb7185" opacity="0.55" />
      {mood === "normal" && <path d="M312 258 Q340 286 368 258" fill="none" stroke="#1e1b4b" strokeWidth="5" strokeLinecap="round" />}
      {mood === "happy" && <path d="M308 250 Q340 295 372 250 Z" fill="#be123c" stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round"/>}
      {mood === "sad" && <path d="M318 282 Q340 262 362 282" fill="none" stroke="#1e1b4b" strokeWidth="5" strokeLinecap="round" />}
      {mood === "cheer" && <ellipse cx="340" cy="270" rx="22" ry="26" fill="#be123c" stroke="#1e1b4b" strokeWidth="4"/>}
      {stage >= 2 && mood === "cheer" && (<g>
        <circle cx="198" cy="262" r="26" fill={body} />
        <circle cx="476" cy="210" r="26" fill={body} />
        <g transform="rotate(-20 400 250)">
          <path d="M398 250 L470 222 L470 278 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="4" strokeLinejoin="round"/>
          <rect x="392" y="244" width="10" height="14" rx="3" fill="#f59e0b"/>
        </g>
        <path d="M500 200 q18 -4 30 -16" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round"/>
        <path d="M512 224 q20 0 34 -8" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round"/>
        <path d="M506 250 q18 4 32 2" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round"/>
      </g>)}
      {stage >= 2 && mood === "sad" && (<g>
        <circle cx="200" cy="272" r="26" fill={body} />
        <circle cx="480" cy="272" r="26" fill={body} />
      </g>)}
      {stage >= 2 && (mood === "normal" || mood === "happy") && (<g>
        <circle cx="200" cy="262" r="26" fill={body} />
        <circle cx="480" cy="262" r="26" fill={body} />
        <path d="M474 240 Q500 224 512 244" fill="none" stroke={body} strokeWidth="14" strokeLinecap="round" />
      </g>)}
      {stage >= 3 && (<path d="M268 300 Q340 322 412 300 L404 330 Q340 346 276 330 Z" fill="#38bdf8" stroke="#0ea5e9" strokeWidth="2"/>)}
      {stage >= 4 && (<path d="M295 135 L313 108 L340 128 L367 108 L385 135 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="3"/>)}
      {stage === 5 && (<g><ellipse cx="340" cy="78" rx="80" ry="14" fill="none" stroke="#fcd34d" strokeWidth="5" opacity="0.9"/><circle cx="313" cy="108" r="6" fill="#fde68a"/><circle cx="340" cy="128" r="6" fill="#fde68a"/><circle cx="367" cy="108" r="6" fill="#fde68a"/></g>)}
    </svg>
  );
}
