export default function DotKun({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 680 460" xmlns="http://www.w3.org/2000/svg">
      <circle cx="248" cy="150" r="13" fill="#a5b4fc" />
      <circle cx="432" cy="150" r="13" fill="#a5b4fc" />
      <circle cx="340" cy="230" r="135" fill="#6366f1" />
      <ellipse cx="340" cy="285" rx="92" ry="78" fill="#eef2ff" />
      <circle cx="298" cy="210" r="30" fill="#ffffff" />
      <circle cx="382" cy="210" r="30" fill="#ffffff" />
      <circle cx="303" cy="214" r="15" fill="#1e1b4b" />
      <circle cx="387" cy="214" r="15" fill="#1e1b4b" />
      <circle cx="309" cy="209" r="5" fill="#ffffff" />
      <circle cx="393" cy="209" r="5" fill="#ffffff" />
      <ellipse cx="262" cy="252" rx="17" ry="11" fill="#fb7185" opacity="0.55" />
      <ellipse cx="418" cy="252" rx="17" ry="11" fill="#fb7185" opacity="0.55" />
      <path d="M312 258 Q340 286 368 258" fill="none" stroke="#1e1b4b" strokeWidth="5" strokeLinecap="round" />
      <circle cx="200" cy="262" r="26" fill="#6366f1" />
      <circle cx="480" cy="262" r="26" fill="#6366f1" />
      <path d="M474 240 Q500 224 512 244" fill="none" stroke="#6366f1" strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}