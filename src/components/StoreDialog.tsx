import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function StoreDialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-[#edf5f3] p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
        if (event.key === "Tab") {
          const nodes = Array.from(
            ref.current?.querySelectorAll<HTMLElement>(
              "button, input, select, textarea, a[href]",
            ) || [],
          ).filter((node) => !node.hasAttribute("disabled"));
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-[#014040]">{title}</h2>
          <button
            className="rounded-xl border border-[#b9d0cb] bg-white px-3 py-2 text-sm font-bold text-[#014040]"
            onClick={close}
            aria-label={`Close ${title}`}
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
