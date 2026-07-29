/** metrics-core · Snapshot-Builder. Läuft im täglichen Cron; das Frontend konsumiert nur das JSON. */
import { computeHeat, fmt, monthly, percentileRank, stats } from './math';
import { defaultSignal, REGISTRY } from './metrics';
import { fetchCrypto, fetchMarket } from './sources';
import {
  BearSnapshot, BubbleSnapshot, FetchContext, MetricResult, MetricSnapshot,
  RatioSnapshot, Row, Snapshot,
} from './types';

export async function buildSnapshot(ctx: FetchContext): Promise<Snapshot> {
  const failed: string[] = [];
  const results = new Map<string, { result: MetricResult; rows: Row[] }>();

  // Registry-Metriken ausfalltolerant, mit gestaffeltem Start (Rate-Limits schonen)
  const settled = await Promise.allSettled(REGISTRY.map(async (def, i) => {
    await new Promise<void>(res => setTimeout(res, i * 400));
    const rows = await def.fetch(ctx);
    return { def, rows, result: def.compute(rows) };
  }));
  const metrics: MetricSnapshot[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'rejected') { failed.push(REGISTRY[i].id); console.warn(REGISTRY[i].id, s.reason); return; }
    const { def, rows, result } = s.value;
    results.set(def.id, { result, rows });
    metrics.push({
      id: def.id, label: def.label, sym: def.sym, assetClass: def.assetClass, kind: def.kind,
      unit: def.unit, dec: def.dec, hex: def.hex,
      current: {
        ...result.current,
        price: +result.current.price.toFixed(def.dec + 2),
        sma: +result.current.sma.toFixed(def.dec + 2),
        value: +result.current.value.toFixed(3),
      },
      signal: defaultSignal(result.current.value),
      interpret: def.interpret(result),
      zones: def.zones, hotAbove: def.hotAbove,
      series: monthly(result.dates, result.values, result.prices),
      stats: stats(result.prices),
      extra: def.extra?.(result),
    });
  });

  const bubbleRes = await buildBubble(ctx, results, failed);
  if (bubbleRes?.basket) metrics.push(bubbleRes.basket);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    failed,
    metrics,
    derived: {
      ratios: buildRatios(results, failed),
      bear: buildBear(results, failed),
      bubble: bubbleRes?.bubble ?? null,
    },
  };
}

/* ===== Metall-Ratios ===== */
function buildRatios(results: Map<string, { result: MetricResult }>, failed: string[]): RatioSnapshot[] {
  const out: RatioSnapshot[] = [];
  const mk = (id: string, title: string, aId: string, bId: string,
    note: (v: number, p: number) => string): void => {
    const A = results.get(aId)?.result; const B = results.get(bId)?.result;
    if (!A || !B) return;
    try {
      const mB = new Map(B.dates.map((d, i) => [d, B.prices[i]]));
      const dates: string[] = []; const vals: number[] = [];
      A.dates.forEach((d, i) => { const b = mB.get(d); if (b) { dates.push(d); vals.push(A.prices[i] / b); } });
      const sorted = [...vals].sort((x, y) => x - y);
      const pct = vals.map(v => percentileRank(sorted, v));
      const cur = vals[vals.length - 1];
      const m = monthly(dates, pct, vals);
      out.push({
        id, title, cur: +cur.toFixed(2),
        med: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
        pct: +percentileRank(sorted, cur).toFixed(3),
        note: note(cur, percentileRank(sorted, cur)),
        series: { months: m.months, pct: m.values, vals: m.prices },
      });
    } catch (e) { failed.push(id); console.warn(id, e); }
  };
  mk('gsr', 'Gold/Silber-Ratio · Wie viele Unzen Silber kostet eine Unze Gold?', 'gold-heat', 'silver-heat',
    (v) => `Eine Unze Gold kostet aktuell so viel wie <b>${fmt(v, 0)} Unzen Silber</b>. ${v > 80
      ? '<b>Das ist historisch viel</b> — Silber ist im Vergleich zu Gold ungewöhnlich billig. Solche Phasen waren in der Vergangenheit oft gute Momente, Silber gegenüber Gold zu bevorzugen.'
      : v < 55 ? '<b>Das ist historisch wenig</b> — Silber ist im Vergleich zu Gold bereits teuer gelaufen.'
      : 'Das liegt im <b>normalen historischen Bereich</b> — keines der beiden Metalle ist relativ zum anderen auffällig bewertet.'}`);
  mk('pgr', 'Palladium/Gold-Ratio · Ist Palladium relativ zu Gold billig?', 'pall-heat', 'gold-heat',
    (v, p) => `Eine Unze Palladium kostet das <b>${fmt(v, 2)}-fache</b> einer Unze Gold. ${p < 0.15
      ? '<b>Historisch extrem wenig</b> — Palladium war relativ zu Gold fast nie so billig wie jetzt. Für Antizykliker der interessanteste Wert auf dieser Seite.'
      : p > 0.85 ? '<b>Historisch extrem viel</b> — Palladium ist relativ zu Gold teuer.'
      : 'Das liegt im normalen historischen Bereich.'}`);
  return out;
}

/* ===== Bärenmarkt-Vergleich (BTC) ===== */
function buildBear(results: Map<string, { result: MetricResult }>, failed: string[]): BearSnapshot | null {
  const S = results.get('btc-risk')?.result;
  if (!S) return null;
  try {
    const MAX = 430;
    const slice = (from: string, to: string) => {
      let pi = -1, pv = 0;
      S.dates.forEach((d, i) => { if (d >= from && d <= to && S.prices[i] > pv) { pv = S.prices[i]; pi = i; } });
      const end = Math.min(S.dates.length, pi + MAX + 1);
      const dates = S.dates.slice(pi, end); const prices = S.prices.slice(pi, end);
      const step = Math.max(1, Math.floor(prices.length / 220));
      const days: number[] = []; const pct: number[] = []; const p: number[] = []; const d: string[] = [];
      for (let i = 0; i < prices.length; i += step) {
        days.push(i); pct.push(+(prices[i] / pv).toFixed(4));
        p.push(Math.round(prices[i])); d.push(dates[i]);
      }
      return { peakDate: S.dates[pi], peak: Math.round(pv), days, pct, prices: p, dates: d, rawLen: prices.length, rawPrices: prices, rawDates: dates };
    };
    const alt = slice('2017-11-01', '2018-01-15');
    const neu = slice('2025-09-01', '2025-11-15');
    const today = neu.rawLen - 1;
    let bi = 0; alt.rawPrices.forEach((p, i) => { if (p < alt.rawPrices[bi]) bi = i; });
    const projected = new Date(new Date(neu.peakDate).getTime() + bi * 864e5).toISOString().slice(0, 10);
    return {
      maxDays: MAX, todayDay: today,
      cycles: [
        { name: 'Zyklus 2017/18', hex: '#8A97AC', peakDate: alt.peakDate, peak: alt.peak, days: alt.days, pct: alt.pct, prices: alt.prices, dates: alt.dates },
        { name: 'Zyklus 2025/26', hex: '#E8963C', peakDate: neu.peakDate, peak: neu.peak, days: neu.days, pct: neu.pct, prices: neu.prices, dates: neu.dates },
      ],
      stats: {
        at18: +(alt.rawPrices[Math.min(today, alt.rawLen - 1)] / alt.peak).toFixed(3),
        atNow: +(neu.rawPrices[neu.rawLen - 1] / neu.peak).toFixed(3),
        bottomDay: bi, bottomPct: +(alt.rawPrices[bi] / alt.peak - 1).toFixed(3),
        bottomDate: alt.rawDates[bi], projected,
      },
    };
  } catch (e) { failed.push('bear'); console.warn('bear', e); return null; }
}

/* ===== KI-Blasen-Score (inkl. Basket + rel. Stärke, hier berechnet) ===== */
async function buildBubble(ctx: FetchContext, results: Map<string, { result: MetricResult }>,
  failed: string[]): Promise<{ bubble: BubbleSnapshot; basket: MetricSnapshot } | null> {
  const n = results.get('ndx-heat')?.result;
  if (!n) return null;
  try {
    const basketSyms: [string, string][] = [['NVDA', 'nvda.us'], ['MSFT', 'msft.us'], ['META', 'meta.us'], ['AMD', 'amd.us'], ['AVGO', 'avgo.us']];
    const [spx, ...stocks] = await Promise.all([
      fetchMarket(ctx, '^GSPC', '^spx'),
      ...basketSyms.map(([y, s]) => fetchMarket(ctx, y, s)),
    ]);
    const maps = stocks.map(rows => new Map(rows));
    let common = [...maps[0].keys()];
    for (const m of maps.slice(1)) common = common.filter(d => m.has(d));
    common.sort();
    const rebased = maps.map(m => { const p0 = m.get(common[0])!; return common.map(d => m.get(d)! / p0); });
    const basketPrices = common.map((_, i) => rebased.reduce((a, s) => a + s[i], 0) / maps.length);
    const basket = computeHeat(common.map((d, i) => [d, basketPrices[i]] as Row));

    const spxMap = new Map(spx);
    const rsVals: number[] = [];
    common.forEach((d, i) => { const s = spxMap.get(d); if (s) rsVals.push(basketPrices[i] / s); });
    const rsSorted = [...rsVals].sort((a, b) => a - b);
    const rsPct = percentileRank(rsSorted, rsVals[rsVals.length - 1]);

    // Basket als vollwertige Metrik in den Snapshot heben (Registry-Format)
    const basketSnap: MetricSnapshot = {
      id: 'ai-basket-heat', label: 'KI-Basket · NVDA, MSFT, META, AMD, AVGO (gleichgewichtet)',
      sym: 'AI-5', assetClass: 'equity', kind: 'heat', unit: '× Start', dec: 2, hex: '#F06FA8',
      current: { ...basket.current, value: +basket.current.value.toFixed(3), price: +basket.current.price.toFixed(2), sma: +basket.current.sma.toFixed(2) },
      signal: defaultSignal(basket.current.value),
      interpret: `Fünf KI-Schwergewichte zu einem Korb gemittelt, damit keine Einzelaktie das Bild verzerrt. ${basket.current.value > 0.85 ? 'Der Korb läuft historisch heiß.' : basket.current.value < 0.15 ? 'Der Korb ist historisch ausgewaschen.' : 'Der Korb bewegt sich im normalen Bereich seiner Geschichte.'}`,
      zones: [{ label: 'Kaufzone', text: '< 0.15', below: 0.15 }], hotAbove: 0.85,
      series: monthly(basket.dates, basket.values, basket.prices),
      stats: stats(basket.prices),
    };

    const comps: [string, number, string][] = [
      ['Nasdaq-Trend', n.current.value, 'Wie heiß läuft der Gesamtmarkt Tech?'],
      ['KI-Aktien-Trend', basket.current.value, 'Wie heiß laufen die KI-Aktien selbst?'],
      ['Vorsprung vor dem Markt', +rsPct.toFixed(3), 'Wie extrem laufen KI-Aktien dem S&P davon?'],
    ];
    const conc = results.get('conc-heat')?.result;
    const cred = results.get('credit-heat')?.result;
    if (conc) comps.push(['Konzentration', conc.current.value, 'Wie stark dominieren die Schwergewichte den S&P?']);
    if (cred) comps.push(['Kredit-Sorglosigkeit', cred.current.value, 'Wie sorglos ist der Anleihemarkt gegenüber Risiko?']);
    return {
      bubble: {
        score: +(comps.reduce((a, c) => a + c[1], 0) / comps.length).toFixed(3),
        comps: comps.map(([a, b, c]) => [a, +b.toFixed(3), c] as [string, number, string]),
      },
      basket: basketSnap,
    };
  } catch (e) { failed.push('bubble'); console.warn('bubble', e); return null; }
}
