"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Search } from "@/components/ui/icons";

export type SelectOption = {
  value: string;
  label: string;
  /** nó opcional à esquerda (ícone, logo de banco, emoji de categoria…) */
  leading?: React.ReactNode;
};

/**
 * Select temático do Zaldo — substitui o `<select>` nativo (cujo dropdown o
 * browser não deixa estilizar). Envia o valor por um `<input hidden name>`,
 * então funciona igual num `<form>` com Server Action.
 *
 * - `searchable` (ou > 8 opções) mostra um campo de filtro no topo.
 * - `leading` por opção permite logo de banco / ícone de categoria.
 */
export function Select({
  name,
  value,
  defaultValue = "",
  onChange,
  options,
  placeholder = "Selecione…",
  searchable,
  className,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [query, setQuery] = useState("");
  const [internal, setInternal] = useState(defaultValue);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const DROPDOWN_HEIGHT = 260;

  const val = value !== undefined ? value : internal;
  const selected = options.find((o) => o.value === val);
  const showSearch = searchable ?? options.length > 8;

  const commit = (v: string) => {
    if (value === undefined) setInternal(v);
    onChange?.(v);
    setOpen(false);
    setQuery("");
  };

  // fecha ao clicar fora / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    if (showSearch) searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, showSearch]);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className={cn("relative", className)} ref={ref}>
      {name && <input type="hidden" name={name} value={val} />}

      <button
        type="button"
        onClick={() => {
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setDropUp(spaceBelow < DROPDOWN_HEIGHT && rect.top > spaceBelow);
          }
          setOpen((o) => !o);
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border bg-bg px-4 py-3 text-left text-sm outline-none transition-colors",
          open ? "border-accent" : "border-line hover:border-accent/50",
        )}
      >
        {selected?.leading}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-40 overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow)]",
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {showSearch && (
            <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-muted">
              <Search size={14} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
              />
            </div>
          )}
          <div className="max-h-60 overflow-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-[13px] text-muted">
                Nada encontrado.
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => commit(o.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-mint",
                    o.value === val && "bg-mint font-semibold text-green",
                  )}
                >
                  {o.leading}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.value === val && <Check size={15} className="shrink-0 text-green" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
