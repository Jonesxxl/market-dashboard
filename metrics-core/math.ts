/** metrics-core · Mathematik. Reine Funktionen, keine Abhängigkeiten. */
import { MetricResult, Row } from './types';

/** Eingefrorene Normierungskonstanten der Zyklus-Risk-Metrik (v1, fixiert 2026-07-19).
 *  Damit reskaliert ein neues Extrem NICHT rückwirkend die Historie (kein Repainting). */
export const RISK_CONSTANTS: Record<string, { lo: number; hi: number; genesis: string }> = {
  btc: { lo: -22.6972, hi: 40.2596, genesis: '2010-07-18' },
  eth: { lo: -30.1171, hi: 31.9041, genesis: '2015-08-08' },
};

export const fmt = (n: number, d = 0): string =>
  n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

export function dedupeSort(rows: Row[]): { dates: string[]; prices: number[] } {
  const map = new Map(rows);
  const dates = [...map.keys()].sort();
  return { dates, prices: dates.map(d => map.get(d)!) };
}

export function percentileRank(sortedAsc: number[], v: number): number {
  let lo = 0, hi = sortedAsc.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sortedAsc[m] <= v) lo = m + 1; else hi = m; }
  return lo / sortedAsc.length;
}

function staleDays(lastDate: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(lastDate).getTime()) / 864e5));
}

/** Heat: historisches Perzentil von ln(Preis / SMA_W). */
export function computeHeat(rows: Row[], W = 200): MetricResult {
  const { dates, prices } = dedupeSort(rows);
  const ext: number[] = []; const extDates: string[] = []; let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i]; if (i >= W) sum -= prices[i - W];
    if (i >= W - 1) { ext.push(Math.log(prices[i] / (sum / W))); extDates.push(dates[i]); }
  }
  const sorted = [...ext].sort((a, b) => a - b);
  const values = ext.map(v => percentileRank(sorted, v));
  const off = dates.length - extDates.length;
  return {
    dates: extDates, prices: prices.slice(off),
    values,
    current: {
      date: extDates[extDates.length - 1], price: prices[prices.length - 1],
      sma: prices.slice(-W).reduce((a, b) => a + b, 0) / W,
      value: values[values.length - 1], staleDays: staleDays(extDates[extDates.length - 1]),
    },
  };
}

/** Zyklus-Risk: min-max-normiertes ln(Preis/SMA374) × Tagesindex^0.395 mit EINGEFRORENEN Konstanten. */
export function computeRisk(rows: Row[], constKey: string, W = 374): MetricResult {
  const { dates, prices } = dedupeSort(rows);
  const C = RISK_CONSTANTS[constKey];
  if (!C) throw new Error('Keine eingefrorenen Konstanten für ' + constKey);
  const t0 = new Date(C.genesis).getTime();
  const values: (number | null)[] = new Array(dates.length).fill(null);
  let sum = 0; let lastSma = 0; let lastIdx = 1;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i]; if (i >= W) sum -= prices[i - W];
    if (i >= W - 1) {
      lastSma = sum / W;
      lastIdx = Math.max(1, (new Date(dates[i]).getTime() - t0) / 864e5);
      const raw = Math.log(prices[i] / lastSma) * Math.pow(lastIdx, 0.395);
      values[i] = Math.min(1, Math.max(0, (raw - C.lo) / (C.hi - C.lo)));
    }
  }
  const sma = lastSma, idx = lastIdx;
  return {
    dates, prices, values,
    current: {
      date: dates[dates.length - 1], price: prices[prices.length - 1], sma,
      value: values[values.length - 1] ?? 0, staleDays: staleDays(dates[dates.length - 1]),
    },
    priceForValue: (r: number) => sma * Math.exp((r * (C.hi - C.lo) + C.lo) / Math.pow(idx, 0.395)),
  };
}

/** Monatliches Downsampling (letzter Wert je Monat) über die letzten `years` Jahre. */
export function monthly(dates: string[], values: (number | null)[], prices: number[], years = 6):
  { months: string[]; values: number[]; prices: number[] } {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - years);
  const cut = cutoff.toISOString().slice(0, 10);
  const months: string[] = []; const v: number[] = []; const p: number[] = [];
  let cur: string | null = null;
  for (let i = 0; i < dates.length; i++) {
    const val = values[i];
    if (dates[i] < cut || val == null) continue;
    const m = dates[i].slice(0, 7);
    if (m !== cur) { months.push(m + '-01'); v.push(val); p.push(prices[i]); cur = m; }
    else { v[v.length - 1] = val; p[p.length - 1] = prices[i]; }
  }
  return { months, values: v.map(x => +x.toFixed(3)), prices: p.map(x => +x.toFixed(4)) };
}

export function stats(prices: number[]): { vsAth: number; lo52: number; hi52: number } {
  const ath = Math.max(...prices);
  const y = prices.slice(-252);
  return {
    vsAth: +(100 * (prices[prices.length - 1] / ath - 1)).toFixed(1),
    lo52: Math.min(...y), hi52: Math.max(...y),
  };
}

/** Generisches Kauf-/Reduzier-Signal aus einem 0–1-Wert: 0 → +1, 0.5 → 0, 1 → −1. */
export function defaultSignal(value: number): number {
  return +Math.min(1, Math.max(-1, (0.5 - value) * 2)).toFixed(3);
}

/** Ratio zweier Kursreihen auf gemeinsamen Daten. */
export function ratioSeries(a: Row[], b: Row[]): Row[] {
  const mB = new Map(b);
  const out: Row[] = [];
  for (const [d, p] of a) { const q = mB.get(d); if (q) out.push([d, p / q]); }
  if (out.length < 300) throw new Error('Ratio: zu wenig überlappende Daten');
  return out;
}
