export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" className={className} aria-hidden>
      <path d="M63 25 L61 13" stroke="#6B3A12" strokeWidth="4" strokeLinecap="round" />
      <path d="M64 19 C72 6 90 4 102 10 C94 22 78 26 64 19 Z" fill="#2F9444" />
      <circle cx="64" cy="72" r="48" fill="#FF8A1F" />
      <circle cx="64" cy="72" r="38" fill="#FFB45C" />
      <path d="M67 69 L67 31 A38 38 0 0 1 104.4 62.4 Z" fill="#FFF1DC" />
      <g stroke="#FF8A1F" strokeWidth="4" strokeLinecap="round">
        <line x1="64" y1="72" x2="64" y2="34" />
        <line x1="64" y1="72" x2="101.4" y2="65.4" />
        <line x1="64" y1="72" x2="88.4" y2="101.1" />
        <line x1="64" y1="72" x2="39.6" y2="101.1" />
        <line x1="64" y1="72" x2="28.3" y2="59" />
      </g>
      <circle cx="64" cy="72" r="5" fill="#FF8A1F" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      <span className="font-display text-[1.15rem] leading-none font-bold tracking-tight">
        Orange <span className="text-brand">Finance</span>
      </span>
    </span>
  );
}
