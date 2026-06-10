export default function DotKun({ size = 40, stage = 2 }: { size?: number; stage?: number }) {
  const body = stage === 1 ? "#a5b4fc" : stage === 2 ? "#6366f1" : stage === 3 ? "#5b54e0" : stage === 4 ? "#4f46e5" : "#4338ca";
  return (
    <svg width={size} height={size} viewBox="150 80 380 320" xmlns="http://www.w3.org/2000/svg">
      {stage >= 4 && <circle cx="340" cy="240" r="170" fill="#fbbf24" opacity={stage === 5 ? 0.22 : 0.12} />}
      {stage === 1 && (<g><path d="M340 95 Q330 70 345 60" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round"/><ellipse cx="352" cy="62" rx="11" ry="7" fill="#22c55e"/></g>)}
      {stage >= 2 && <circle cx="248" cy="150" r="13" fill="#a5b4fc" />}
      {stage >= 2 && <circle cx="432" cy="150" r="13" fill="#a5b4fc" />}
      {stage >= 4 && (<g><path d="M250 340 Q210 250 235 175 L255 185 Q240 270 285 350 Z" fill="#7c3aed" opacity="0.85"/><path d="M430 340 Q470 250 445 175 L425 185 Q440 270 395 350 Z" fill="#7c3aed" opacity="0.85"/></g>)}
      <circle cx="340" cy="230" r="135" fill={body} />
      <ellipse cx="340" cy="285" rx="92" ry="78" fill="#eef2ff" />
      <circle cx="298" cy="210" r="30" fill="#ffffff" />
      <circle cx="382" cy="210" r="30" fill="#ffffff" />
      <circle cx="303" cy="214" r="15" fill="#1e1b4b" />
      <circle cx="387" cy="214" r="15" fill="#1e1b4b" />
      <circle cx="309" cy="209" r="5" fill="#ffffff" />
      <circle cx="393" cy="209" r="5" fill="#ffffff" />
      <ellipse cx="262" cy="252" rx={stage === 1 ? 22 : 17} ry={stage === 1 ? 14 : 11} fill="#fb7185" opacity="0.55" />
      <ellipse cx="418" cy="252" rx={stage === 1 ? 22 : 17} ry={stage === 1 ? 14 : 11} fill="#fb7185" opacity="0.55" />
      <path d="M312 258 Q340 286 368 258" fill="none" stroke="#1e1b4b" strokeWidth="5" strokeLinecap="round" />
      {stage >= 2 && <circle cx="200" cy="262" r="26" fill={body} />}
      {stage >= 2 && <circle cx="480" cy="262" r="26" fill={body} />}
      {stage >= 2 && <path d="M474 240 Q500 224 512 244" fill="none" stroke={body} strokeWidth="14" strokeLinecap="round" />}
      {stage >= 3 && (<path d="M268 300 Q340 322 412 300 L404 330 Q340 346 276 330 Z" fill="#38bdf8" stroke="#0ea5e9" strokeWidth="2"/>)}
      {stage >= 4 && (<path d="M295 135 L313 108 L340 128 L367 108 L385 135 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="3"/>)}
      {stage === 5 && (<g><ellipse cx="340" cy="78" rx="80" ry="14" fill="none" stroke="#fcd34d" strokeWidth="5" opacity="0.9"/><circle cx="313" cy="108" r="6" fill="#fde68a"/><circle cx="340" cy="128" r="6" fill="#fde68a"/><circle cx="367" cy="108" r="6" fill="#fde68a"/><path d="M230 160 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6 z" fill="#fcd34d"/><path d="M450 170 l5 11 11 5 -11 5 -5 11 -5 -11 -11 -5 11 -5 z" fill="#fcd34d"/></g>)}
    </svg>
  );
}
