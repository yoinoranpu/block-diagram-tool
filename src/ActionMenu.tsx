import { useEffect, useRef, useState, type ReactNode } from "react";

export function ActionMenu({
  label,
  children,
  initialOpen = false,
  position,
}: {
  label: string;
  children: ReactNode;
  initialOpen?: boolean;
  position?: { x: number; y: number };
}) {
  const [open, setOpen] = useState(initialOpen);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="action-menu" ref={root}>
      <button ref={trigger} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label} ▾
      </button>
      {open && (
        <div
          className="action-menu-panel"
          style={
            position
              ? {
                  position: "fixed",
                  left: Math.max(
                    8,
                    Math.min(position.x, window.innerWidth - 210),
                  ),
                  top: Math.max(
                    8,
                    Math.min(position.y, window.innerHeight - 270),
                  ),
                }
              : undefined
          }
          onClick={(e) => {
            if ((e.target as Element).closest("button")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
