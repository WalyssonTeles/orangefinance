import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Keeps text on a single line and shrinks its font just enough to fit the available width
 * (e.g. "R$ 150.000,00" inside a narrow card). Never grows above the inherited size.
 */
export function Fit({ children, className = "", min = 0.5 }: { children: ReactNode; className?: string; min?: number }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const text = inner.current;
    if (!box || !text) return;
    const fit = () => {
      text.style.fontSize = "";
      const available = box.clientWidth;
      const needed = text.scrollWidth;
      if (available > 0 && needed > available) {
        text.style.fontSize = `${Math.max(min, Math.floor((available / needed) * 1000) / 1000)}em`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  });

  return (
    <span ref={outer} className={`block min-w-0 overflow-hidden ${className}`}>
      <span ref={inner} className="inline-block whitespace-nowrap">
        {children}
      </span>
    </span>
  );
}
