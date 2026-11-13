"use client";

import { useEffect, useRef } from "react";
import { formatNis } from "@/lib/formatMoney";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";

type Props = {
  value: number;
  locale: string;
  className?: string;
  /**
   * Count from the old value to the new one. Reserved for the figure the table watches
   * (the bank); everything else just flashes.
   */
  roll?: boolean;
};

const ROLL_MS = 420;

/**
 * A shekel amount that acknowledges change. Live sync re-renders the page silently;
 * this makes the cell that moved visible for a moment.
 */
export function LiveAmount({ value, locale, className = "", roll = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useFlashOnChange(ref, value);

  useEffect(() => {
    const from = shown.current;
    shown.current = value;
    // Write into React's own text node (never replace it), so later renders still land.
    const node = ref.current?.firstChild;
    if (!roll || !(node instanceof Text) || from === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // React already wrote the final text; paint intermediate values over it, then
    // land on exactly what React rendered so the DOM and React agree.
    const finalText = formatNis(locale, value);
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / ROLL_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      node.data =
        t < 1 ? formatNis(locale, Math.round(from + (value - from) * eased)) : finalText;
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
      node.data = finalText;
    };
  }, [value, locale, roll]);

  return (
    <span ref={ref} className={`inline-block px-1 -mx-1 ${className}`} dir="ltr">
      {formatNis(locale, value)}
    </span>
  );
}
