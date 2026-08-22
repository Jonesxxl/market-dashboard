/** metrics-core · Mathematik. Reine Funktionen, keine Abhängigkeiten. */
import { MetricResult, Row } from './types';

/** Eingefrorene Konstanten der Zyklus-Risk-Metrik. Eingefroren heißt: Ein neues Extrem
 *  reskaliert die Historie NICHT rückwirkend (kein Repainting). Geändert wird nur bewusst,
 *  mit Versionssprung und neuer Kalibrierung.
 *
 *  Normierung und Formparameter je Asset. `W` (Fenster des gleitenden Durchschnitts) und
 *  `exp` (Zeitgewichtung) gehören mit hierher, weil sie sich nicht unabhängig von `lo`/`hi`
 *  ändern lassen — jede Kombination ist eine eigene, eingefrorene Kalibrierung.
 *
 *  btc · v2, kalibriert 2026-08-22 gegen 15 abgelesene Referenzpunkte der Risk-Kurve von
 *  Into the Cryptoverse ab 2017 (Leave-one-out-Fehler 0,049; die Vorgängerversion lag im
 *  Mittel 0,077 zu tief). Bewusst nur auf Punkte ab 2017 gefittet: Vor 2016 weichen schon
 *  die Kursquellen um bis zu 8,5 % voneinander ab, und der Chart der Seite zeigt sechs
 *  Jahre — dort wird die frühe Abweichung von bis zu 0,22 gar nicht sichtbar.
 *
 *  eth · unverändert v1. Für Ethereum liegen keine Referenzpunkte vor, deshalb bleiben
 *  Fenster und Exponent der alten Kalibrierung stehen. */
export const RISK_CONSTANTS: Record<string, { lo: number; hi: number; genesis: string; W: number; exp: number }> = {
  btc: { lo: -5.7827, hi: 8.4375, genesis: '2010-07-18', W: 340, exp: 0.2 },
  eth: { lo: -30.1171, hi: 31.9041, genesis: '2015-08-08', W: 374, exp: 0.395 },
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

/** Für Reihen, die bereits eine fertige Kennzahl sind (z.B. den MVRV-Z-Score): Der Rohwert
 *  bleibt als `price` erhalten, `value` ist sein historisches Perzentil. Damit fügt sich die
 *  Metrik in dieselbe 0…1-Darstellung wie alle anderen, ohne ihre gewohnte Skala zu verlieren.
 *  Anders als computeHeat wird hier nichts logarithmiert — die Werte dürfen negativ sein. */
export function computeIndicator(rows: Row[], W = 200): MetricResult {
  const { dates, prices } = dedupeSort(rows);
  if (prices.length < W) throw new Error(`Zu wenig Historie: ${prices.length} Tage (mindestens ${W})`);
  const sorted = [...prices].sort((a, b) => a - b);
  const values = prices.map(v => percentileRank(sorted, v));
  return {
    dates, prices, values,
    current: {
      date: dates[dates.length - 1],
      price: prices[prices.length - 1],
      sma: prices.slice(-W).reduce((a, b) => a + b, 0) / W,
      value: values[values.length - 1],
      staleDays: staleDays(dates[dates.length - 1]),
    },
  };
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

/** Zyklus-Risk: min-max-normiertes ln(Preis/SMA_W) × Tagesindex^exp — W, exp und die
 *  Normierungsgrenzen kommen aus RISK_CONSTANTS und sind je Asset eingefroren. */
export function computeRisk(rows: Row[], constKey: string): MetricResult {
  const { dates, prices } = dedupeSort(rows);
  const C = RISK_CONSTANTS[constKey];
  if (!C) throw new Error('Keine eingefrorenen Konstanten für ' + constKey);
  const W = C.W;
  const t0 = new Date(C.genesis).getTime();
  const values: (number | null)[] = new Array(dates.length).fill(null);
  let sum = 0; let lastSma = 0; let lastIdx = 1;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i]; if (i >= W) sum -= prices[i - W];
    if (i >= W - 1) {
      lastSma = sum / W;
      lastIdx = Math.max(1, (new Date(dates[i]).getTime() - t0) / 864e5);
      const raw = Math.log(prices[i] / lastSma) * Math.pow(lastIdx, C.exp);
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
    priceForValue: (r: number) => sma * Math.exp((r * (C.hi - C.lo) + C.lo) / Math.pow(idx, C.exp)),
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
