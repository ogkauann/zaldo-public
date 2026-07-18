import "server-only";

/**
 * Dados de cripto para a aba "Descobrir" — informativo, read-only.
 * Fonte: CoinGecko (grátis, sem chave), tudo em BRL. Buscamos no servidor com
 * cache (revalidate) — 1 request serve todos os usuários e respeita o rate limit.
 */

const CG = "https://api.coingecko.com/api/v3";

export type Coin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number | null;
  marketCap: number;
  /** Preços horários dos últimos 7 dias (vem junto da lista, sem chamada extra). */
  spark7d: number[];
};

export type ChartPoint = { t: number; price: number };

/** Top moedas por market cap, cotadas em BRL. Nunca lança — devolve []. */
export async function getCryptoMarkets(perPage = 10): Promise<Coin[]> {
  try {
    const url =
      `${CG}/coins/markets?vs_currency=brl&order=market_cap_desc` +
      `&per_page=${perPage}&page=1&price_change_percentage=24h&sparkline=true`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const data: Array<{
      id: string;
      symbol: string;
      name: string;
      image: string;
      current_price: number;
      price_change_percentage_24h: number | null;
      market_cap: number;
      sparkline_in_7d?: { price: number[] };
    }> = await res.json();
    return data.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      image: c.image,
      price: c.current_price,
      change24h: c.price_change_percentage_24h,
      marketCap: c.market_cap,
      spark7d: c.sparkline_in_7d?.price ?? [],
    }));
  } catch {
    return [];
  }
}

/** Histórico de preço (BRL) de uma moeda para o gráfico. Nunca lança. */
export async function getCryptoChart(
  id: string,
  days: number,
): Promise<ChartPoint[]> {
  try {
    const url = `${CG}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=brl&days=${days}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const data: { prices: [number, number][] } = await res.json();
    return data.prices.map(([t, price]) => ({ t, price }));
  } catch {
    return [];
  }
}

/** Cotação do dólar (USD→BRL): AwesomeAPI com fallback no PTAX do BCB
 *  (via BrasilAPI) — a AwesomeAPI limita requisições por IP e derruba os
 *  IPs compartilhados da Vercel de tempos em tempos. Nunca lança. */
export async function getDollar(): Promise<{ bid: number; pct: number | null } | null> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL", {
      next: { revalidate: 60 * 15 },
    });
    if (!res.ok) throw new Error(`awesomeapi ${res.status}`);
    const data: { USDBRL: { bid: string; pctChange: string } } = await res.json();
    const bid = Number(data.USDBRL.bid);
    if (!Number.isFinite(bid) || bid <= 0) throw new Error("awesomeapi bid inválido");
    return { bid, pct: Number(data.USDBRL.pctChange) };
  } catch {
    // Fallback: PTAX (BCB) — tenta hoje e volta até 4 dias (fim de semana/feriado)
    for (let back = 0; back <= 4; back++) {
      try {
        const d = new Date();
        d.setDate(d.getDate() - back);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const res = await fetch(`https://brasilapi.com.br/api/cambio/v1/cotacao/USD/${iso}`, {
          next: { revalidate: 60 * 60 },
        });
        if (!res.ok) continue;
        const data: { cotacoes: { cotacao_venda: number }[] } = await res.json();
        const ultima = data.cotacoes?.at(-1)?.cotacao_venda;
        if (ultima && Number.isFinite(ultima)) return { bid: ultima, pct: null };
      } catch {
        // tenta o dia anterior
      }
    }
    return null;
  }
}
