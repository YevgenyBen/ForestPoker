"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Replays the CSS animation classes on `ref` whenever `value` changes after mount.
 * The first render never animates, so a page load is calm and only real changes
 * (the viewer's own entry, or a live update from another player) draw the eye.
 */
export function useFlashOnChange(
  ref: RefObject<HTMLElement | null>,
  value: unknown,
  classNames: readonly string[] = ["fp-flash"]
) {
  const previous = useRef(value);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    const el = ref.current;
    if (!el) return;
    el.classList.remove(...classNames);
    // Force a style flush so re-adding the classes restarts the animation.
    void el.offsetWidth;
    el.classList.add(...classNames);
    const done = () => el.classList.remove(...classNames);
    el.addEventListener("animationend", done, { once: true });
    return () => el.removeEventListener("animationend", done);
    // classNames is a fixed list per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ref]);
}
