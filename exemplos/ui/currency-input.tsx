"use client";

import { cn } from "@/lib/utils";

/** Formata uma string de dígitos (centavos) como "1.234,56". */
function formatCents(digits: string) {
  const cents = parseInt(digits || "0", 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Input de valor em Reais com máscara — digita só números, o cursor sempre
 * fica nos centavos (padrão de app bancário), sem spinners nativos.
 * `value`/`onChange` trabalham com string decimal ("123.45"), igual ao
 * `Input type="number"` que substitui.
 */
export function CurrencyInput({
  id,
  name,
  label,
  value,
  onChange,
  required,
  className,
}: {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const digits = value ? String(Math.round(Number(value) * 100)) : "";
  const display = digits ? formatCents(digits) : "";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    onChange(raw ? (parseInt(raw, 10) / 100).toFixed(2) : "");
  }

  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={id}>
      {label && <span className="font-medium text-ink">{label}</span>}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-3 transition-colors focus-within:border-accent",
          className,
        )}
      >
        <span className="text-sm text-muted">R$</span>
        <input
          id={id}
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          placeholder="0,00"
          className="w-full min-w-0 bg-transparent text-sm text-ink outline-none"
        />
      </div>
      {name && <input type="hidden" name={name} value={value} required={required} />}
    </label>
  );
}
