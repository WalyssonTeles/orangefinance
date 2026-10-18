export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}orange-finance-symbol.svg`}
      className={className}
      alt=""
      aria-hidden="true"
    />
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
