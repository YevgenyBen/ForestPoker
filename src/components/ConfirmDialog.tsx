"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-page confirmation modal. Use instead of `window.confirm()`, which some
 * in-app browsers suppress (it returns false without showing anything).
 */
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Esc key
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      // A click on the dialog element itself (not its content) is the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--fp-wood-mid)]/30 bg-[var(--fp-panel)] p-0 text-[var(--fp-ink)] shadow-xl backdrop:bg-black/50"
    >
      <div className="space-y-4 p-5">
        <p className="text-base font-semibold" dir="auto">
          {message}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[var(--fp-wood-mid)]/40 px-3 py-2.5 text-sm font-semibold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[var(--fp-loss)] px-3 py-2.5 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
