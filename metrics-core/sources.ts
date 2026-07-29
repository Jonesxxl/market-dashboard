/** metrics-core · Datenquellen. Läuft in Node (Cron, direkte URLs) und im Browser (Proxy-Pfade). */
import { FetchContext, Row } from './types';

const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };

/** Bis zu `tries` Versuche mit wachsendem Backoff — Yahoo/Stooq drosseln gern kurzzeitig. */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let a = 1; a <= tries; a++) {
    try { return await fn(); }
    catch (e) { lastErr = e; if (a < tries) await delay(1200 * a); }
  }
  throw lastErr;
}

export const NODE_CTX: FetchContext = {
  yahooBase: 'https://query1.finance.yahoo.com',
  stooqBase: 'https://stooq.com',
};

export async function fetchCoinMetrics(asset: string): Promise<Row[]> {
  const res = await fetch(`https://raw.githubusercontent.com/coinmetrics/data/master/csv/${asset}.csv`);
  if (!res.ok) throw new Error('Coin Metrics HTTP ' + res.status);
  const lines = (await res.text()).split('\n');
  const head = lines[0].split(',');
  const iT = head.indexOf('time'), iP = head.indexOf('PriceUSD'), iR = head.indexOf('ReferenceRateUSD');
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < 3) continue;
    const p = parseFloat(c[iP]) || parseFloat(c[iR]);
    if (c[iT] && isFinite(p) && p > 0) out.push([c[iT], p]);
  }
  return out;
}

export async function fetchGecko(id: string, tries = 3): Promise<Row[]> {
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=365&interval=daily`);
      if (!res.ok) throw new Error('CoinGecko HTTP ' + res.status);
      const j = (await res.json()) as { prices: [number, number][] };
      return j.prices.map(([ms, p]) => [new Date(ms).toISOString().slice(0, 10), p]);
    } catch (e) {
      if (a === tries) throw e;
      await delay(900 * a);
    }
  }
  return [];
}

interface YahooChart {
  chart: {
    result: {
      meta?: { dataGranularity?: string };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[]; adjclose?: { adjclose: (number | null)[] }[] };
    }[] | null;
    error: { description: string } | null;
  };
}

async function fetchYahoo(ctx: FetchContext, symbol: string): Promise<Row[]> {
  const res = await fetch(`${ctx.yahooBase}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=0&period2=9999999999&interval=1d`, { headers: UA });
  if (!res.ok) throw new Error('Yahoo HTTP ' + res.status + ' (' + symbol + ')');
  const j = (await res.json()) as YahooChart;
  const r = j.chart.result?.[0];
  if (!r || !r.timestamp) throw new Error('Yahoo ' + symbol + ': leere Antwort' + (j.chart.error ? ' (' + j.chart.error.description + ')' : ''));
  const gran = r.meta?.dataGranularity;
  if (gran && gran !== '1d') throw new Error('Yahoo ' + symbol + ': Granularität ' + gran + ' statt 1d');
  const closes = r.indicators.quote[0].close;
  const adj = r.indicators.adjclose?.[0]?.adjclose;
  const out: Row[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const a = adj?.[i];
    const p = (a != null && isFinite(a) && a > 0) ? a : closes[i];
    if (p != null && isFinite(p) && p > 0) out.push([new Date(r.timestamp[i] * 1000).toISOString().slice(0, 10), p]);
  }
  if (out.length < 300) throw new Error('Yahoo ' + symbol + ': zu wenig Historie (' + out.length + ' Punkte)');
  return out;
}

async function fetchStooq(ctx: FetchContext, symbol: string): Promise<Row[]> {
  const res = await fetch(`${ctx.stooqBase}/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`, { headers: UA });
  if (!res.ok) throw new Error('Stooq HTTP ' + res.status + ' (' + symbol + ')');
  const text = (await res.text()).trim();
  const lines = text.split('\n');
  if (lines.length < 10) throw new Error('Stooq ' + symbol + ': "' + text.slice(0, 60) + '"');
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const p = parseFloat(c[4]);
    if (c[0] && isFinite(p) && p > 0) out.push([c[0], p]);
  }
  return out;
}

/** Yahoo primär (mit Retries), Stooq Fallback (mit Retries). */
export async function fetchMarket(ctx: FetchContext, ySym: string, sSym: string): Promise<Row[]> {
  try { return await withRetry(() => fetchYahoo(ctx, ySym)); }
  catch (e) {
    console.warn('Yahoo endgültig fehlgeschlagen, versuche Stooq:', (e as Error).message);
    return withRetry(() => fetchStooq(ctx, sSym));
  }
}

/** Gleichgewichteter Krypto-Korb: nimmt alle Kandidaten mit ausreichend Historie auf.
 *  CoinGecko schließt je Mitglied die Coin-Metrics-Lücke bis heute (ausfalltolerant). */
export async function fetchCryptoBasket(candidates: [cm: string, gecko: string, yahoo?: string][],
  minDays = 1500, ctx: FetchContext = NODE_CTX): Promise<Row[]> {
  const settled = await Promise.allSettled(candidates.map(async ([cm, gecko, yahoo], i) => {
    await delay(700 * i); // Ratelimits der Anbieter staffeln
    const rows = await fetchCrypto(cm, gecko, yahoo, ctx);
    if (rows.length < minDays) throw new Error(cm + ': nur ' + rows.length + ' Tage Historie');
    return rows;
  }));
  const members = settled.filter((x): x is PromiseFulfilledResult<Row[]> => x.status === 'fulfilled')
    .map(x => x.value);
  if (members.length < 3) throw new Error('Basket: nur ' + members.length + ' Mitglieder mit Historie');
  const maps = members.map(rows => new Map(rows));
  let common = [...maps[0].keys()];
  for (const m of maps.slice(1)) common = common.filter(d => m.has(d));
  common.sort();
  const rebased = maps.map(m => { const p0 = m.get(common[0])!; return common.map(d => m.get(d)! / p0); });
  return common.map((d, i) => [d, rebased.reduce((a, s2) => a + s2[i], 0) / maps.length]);
}

/** Krypto: mehrere Quellen zusammenführen, damit die Aktualität nie an einem Anbieter hängt.
 *  Coin Metrics liefert die tiefe Historie, Yahoo und CoinGecko die jüngsten Tage.
 *  Reihenfolge = Priorität bei gleichem Datum (später gewinnt, siehe dedupeSort/Map). */
export async function fetchCrypto(cmAsset: string, geckoId: string, yahooSym?: string,
  ctx: FetchContext = NODE_CTX): Promise<Row[]> {
  const parts: Row[][] = [];
  const errors: string[] = [];

  const cm = await fetchCoinMetrics(cmAsset).catch((e: Error) => { errors.push('CoinMetrics: ' + e.message); return [] as Row[]; });
  if (cm.length) parts.push(cm);

  if (yahooSym) {
    const y = await withRetry(() => fetchYahoo(ctx, yahooSym))
      .catch((e: Error) => { errors.push('Yahoo: ' + e.message); return [] as Row[]; });
    if (y.length) parts.push(y);
  }

  const gk = await fetchGecko(geckoId).catch((e: Error) => { errors.push('CoinGecko: ' + e.message); return [] as Row[]; });
  if (gk.length) parts.push(gk);

  if (!parts.length) throw new Error(cmAsset + ': keine Quelle erreichbar — ' + errors.join(' · '));
  const merged = parts.flat();
  const newest = merged.reduce((a, r) => (r[0] > a ? r[0] : a), '');
  const ageDays = Math.round((Date.now() - new Date(newest).getTime()) / 864e5);
  if (ageDays > 5) console.warn(`${cmAsset}: neuester Kurs ist ${ageDays} Tage alt (${newest}) — ${errors.join(' · ') || 'alle Quellen lieferten veraltete Daten'}`);
  return merged;
}
