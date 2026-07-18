"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(s: string) {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}
function formatBR(s: string) {
  return s ? fromISO(s).toLocaleDateString("pt-BR") : "";
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * Calendário próprio (popover) no lugar do `<input type="date">` nativo —
 * a UI do calendário nativo varia demais entre navegador/SO e não segue o
 * design system. Guarda/emite data como "YYYY-MM-DD", igual ao input nativo.
 */
export function DatePicker({
  id,
  name,
  label,
  value,
  defaultValue,
  onChange,
  required,
  className,
}: {
  id?: string;
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const val = value !== undefined ? value : internal;
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = val ? fromISO(val) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(d: Date) {
    const iso = toISO(d);
    if (value === undefined) setInternal(iso);
    onChange?.(iso);
    setOpen(false);
  }

  function openPicker() {
    if (val) setViewMonth(new Date(fromISO(val).getFullYear(), fromISO(val).getMonth(), 1));
    setOpen((o) => !o);
  }

  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  return (
    <div className={cn("relative", className)} ref={ref}>
      <label className="flex flex-col gap-1.5 text-sm" htmlFor={id}>
        {label && <span className="font-medium text-ink">{label}</span>}
        <button
          type="button"
          id={id}
          onClick={openPicker}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl border bg-bg px-4 py-3 text-left text-sm outline-none transition-colors",
            open ? "border-accent" : "border-line hover:border-accent/50",
          )}
        >
          <span className={cn(!val && "text-muted")}>{val ? formatBR(val) : "Selecionar…"}</span>
          <CalendarIcon size={16} className="shrink-0 text-muted" />
        </button>
      </label>
      {name && <input type="hidden" name={name} value={val} required={required} />}

      {open && (
        <div className="absolute left-0 z-40 mt-1.5 w-[280px] rounded-xl border border-line bg-card p-3 shadow-[var(--shadow)]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-mint"
            >
              ‹
            </button>
            <span className="text-sm font-semibold capitalize">
              {viewMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-mint"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const iso = toISO(d);
              const isSelected = val === iso;
              const isToday = toISO(new Date()) === iso;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => commit(d)}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg text-[13px] transition-colors hover:bg-mint",
                    isSelected
                      ? "bg-accent font-bold text-accent-ink"
                      : isToday
                        ? "font-semibold text-green"
                        : "text-ink",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {!required && val && (
            <button
              type="button"
              onClick={() => {
                if (value === undefined) setInternal("");
                onChange?.("");
                setOpen(false);
              }}
              className="mt-2 text-[12px] font-semibold text-muted hover:text-ink"
            >
              Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
