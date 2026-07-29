/** metrics-core · Typen — von Frontend, Snapshot-Cron, Report und Generator gemeinsam genutzt. */

export type Row = [string, number]; // [ISO-Datum, Kurs]

export type AssetClass = 'crypto' | 'metal' | 'equity' | 'fx' | 'credit';
export type MetricKind = 'risk' | 'heat';

export interface Zone { label: string; text: string; below: number; }

export interface MetricCurrent {
  date: string; price: number; sma: number; value: number; staleDays: number;
}

export interface MetricSeries { months: string[]; values: number[]; prices: number[]; }

export interface MetricStats { vsAth: number; lo52: number; hi52: number; }

export interface MetricSnapshot {
  id: string; label: string; sym: string; assetClass: AssetClass; kind: MetricKind;
  unit: string; dec: number; hex: string;
  current: MetricCurrent;
  /** −1 (stark akkumulieren) … +1 (stark reduzieren) — Basis für den Generator. */
  signal: number;
  /** Klartext-Deutung des aktuellen Werts (Deutsch). */
  interpret: string;
  zones: Zone[]; hotAbove: number | null;
  series: MetricSeries;
  stats: MetricStats;
  extra?: {
    riskLevels?: { r: number; price: number }[];
    ghosts?: { r: number; t: string }[];
  };
}

export interface MetricResult {
  dates: string[]; prices: number[]; values: (number | null)[];
  current: MetricCurrent;
  priceForValue?: (v: number) => number;
}

/** Eine Metrik = eine Datei. Neue Metriken registrieren sich nur hier. */
export interface MetricDefinition {
  id: string; label: string; sym: string; assetClass: AssetClass; kind: MetricKind;
  unit: string; dec: number; hex: string;
  zones: Zone[]; hotAbove: number | null;
  fetch(ctx: FetchContext): Promise<Row[]>;
  compute(rows: Row[]): MetricResult;
  interpret(r: MetricResult): string;
  extra?(r: MetricResult): MetricSnapshot['extra'];
}

export interface FetchContext {
  yahooBase: string;   // Node: https://query1.finance.yahoo.com · Browser-Proxy: /yf
  stooqBase: string;   // Node: https://stooq.com · Browser-Proxy: /stooq
}

/* ===== Abgeleitete Bausteine ===== */
export interface RatioSnapshot {
  id: string; title: string; cur: number; med: number; pct: number; note: string;
  series: { months: string[]; pct: number[]; vals: number[] };
}

export interface BearCycle {
  name: string; hex: string; peakDate: string; peak: number;
  days: number[]; pct: number[]; prices: number[]; dates: string[];
}
export interface BearSnapshot {
  maxDays: number; todayDay: number;
  cycles: BearCycle[]; // [2017/18, 2025/26]
  stats: { at18: number; atNow: number; bottomDay: number; bottomPct: number; bottomDate: string; projected: string };
}

export interface BubbleSnapshot { score: number; comps: [string, number, string][]; }

export interface Snapshot {
  version: 1;
  /** true = mitgeliefertes Demo-JSON aus dem Build-Paket, NICHT vom täglichen Lauf.
   *  Der erste erfolgreiche GitHub-Action-Lauf schreibt die Datei ohne dieses Flag. */
  bootstrap?: boolean;
  generatedAt: string;
  failed: string[];
  metrics: MetricSnapshot[];
  derived: {
    ratios: RatioSnapshot[];
    bear: BearSnapshot | null;
    bubble: BubbleSnapshot | null;
  };
}
