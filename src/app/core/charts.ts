import { datum, fmt, monat } from '../../../metrics-core/math';
import { PALETTE } from '../../../metrics-core/palette';
import { BearCycle } from '../../../metrics-core/types';

/** Zeichenfläche eines Charts in viewBox-Einheiten: Breite, Höhe und die vier Ränder. */
export interface Frame { w: number; h: number; l: number; r: number; t: number; b: number; }

export interface TipData {
  /** Beschriftung je Punkt (Monat oder Zyklustag). */
  m: string[];
  /** Position je Punkt auf der 0…1-Höhenachse des Charts. */
  v: number[];
  /** Wert, der zusätzlich im Tooltip steht (Kurs, Kennzahl). */
  p: number[] | null;
  l: string; u: string;
  /** 'pct' zeigt v als Prozent, 'none' blendet v aus (dann trägt p den Wert). */
  f?: 'pct' | 'none';
  /** Anteil der Breite, den die Punkte belegen — der Bärenmarkt-Chart endet vor dem Rand. */
  s?: number;
  /** Dieselbe Zeichenfläche, mit der gezeichnet wurde. Der Tooltip rechnet damit die
   *  Mausposition auf den Datenpunkt um — mit eigenen Konstanten lag er daneben. */
  frame: Frame;
}

export interface ChartSvg { svg: string; tip: TipData; }

const DEFAULT_YEARS = 6;

/* ===== Bausteine ===== */

/** ISO-Datum vor `years` Jahren: Beginn des sichtbaren Zeitraums. */
function cutoff(years: number): string {
  const d = new Date(); d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}


/** Länge des Streckenzugs in Nutzerkoordinaten. Wird für stroke-dasharray gebraucht:
 *  Nur mit der echten Länge läuft die Einzeichnung gleichmäßig durch statt am Ende
 *  stehenzubleiben (oder abgeschnitten zu wirken). */
function polylineLength(n: number, x: (i: number) => number, y: (i: number) => number): number {
  let len = 0;
  for (let i = 1; i < n; i++) len += Math.hypot(x(i) - x(i - 1), y(i) - y(i - 1));
  return Math.ceil(len);
}

/** Waagrechte Gitterlinie mit Achsenbeschriftung links. */
function gridLine(f: Frame, y: number, text: string): string {
  return `<line x1="${f.l}" x2="${f.w - f.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${PALETTE.line}" stroke-width="1"/>
        <text x="${f.l - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end">${text}</text>`;
}

/** Gestrichelte Orientierungslinie über die ganze Breite. */
function dashedLine(f: Frame, y: number, color: string, dash: string, opacity = ''): string {
  return `<line x1="${f.l}" x2="${f.w - f.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1" stroke-dasharray="${dash}"${opacity ? ` opacity="${opacity}"` : ''}/>`;
}

/** Senkrechte Marke mit Jahreszahl an jedem Januar. `months` im Format YYYY-MM. */
function yearMarks(f: Frame, months: string[], x: (i: number) => number): string {
  return months.map((m, i) => m.endsWith('-01')
    ? `<line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${f.t}" y2="${f.h - f.b}" stroke="${PALETTE.line}" opacity=".6"/>
        <text x="${x(i).toFixed(1)}" y="${f.h - 6}" text-anchor="middle">${m.slice(0, 4)}</text>`
    : '').join('');
}

/** Verlaufslinie samt Endpunkt und Endwert. Die Klassen `draw` und `tip-dot` tragen die
 *  Einblend-Animation aus styles.css; `--len` ist die Pfadlänge für stroke-dasharray. */
function drawnLine(f: Frame, n: number, x: (i: number) => number, y: (i: number) => number,
  color: string, endText: string): string {
  const d = Array.from({ length: n }, (_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(i).toFixed(1)}`).join(' ');
  const lx = x(n - 1), ly = y(n - 1);
  return `<path class="draw" style="--len:${polylineLength(n, x, y)}" d="${d}" fill="none" stroke="${color}" stroke-width="1.8"/>
      <circle class="tip-dot" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.2" fill="${color}"/>
      <text class="tip-dot" x="${Math.min(lx + 5, f.w - f.r)}" y="${ly < f.t + 14 ? ly + 14 : ly - 6}" text-anchor="end" style="fill:${color};font-weight:600">${endText}</text>`;
}

/** Beschriftung oben rechts. */
const caption = (f: Frame, text: string): string =>
  `<text x="${f.w - f.r}" y="${f.t + 2}" text-anchor="end">${text}</text>`;

const svgDoc = (f: Frame, aria: string, body: string): string =>
  `<svg viewBox="0 0 ${f.w} ${f.h}" style="width:100%;height:auto" role="img" aria-label="${aria}">${body}</svg>`;

/* ===== Charts ===== */

export interface SparklineOptions {
  dates: string[];
  values: (number | null)[];
  color: string;
  /** Name der Kennzahl in Chart und Tooltip. */
  label?: string;
  /** Zweite Reihe, die nur im Tooltip erscheint — etwa der Kurs zum Heat-Wert. */
  prices?: number[] | null;
  unit?: string;
  dec?: number;
  /** Gestrichelte Linien [Kauf, Warnung]; `null` bei Metriken ohne Zonen. */
  bands?: readonly [number, number] | null;
  years?: number;
}

/** Verlaufschart auf der festen 0…1-Achse (monatlich, mit Achsenskala, Schwellenlinien, Endwert). */
export function sparklineSvg({
  dates, values, color, label = 'Heat', prices = null, unit = '', dec = 2,
  bands = [0.15, 0.85], years = DEFAULT_YEARS,
}: SparklineOptions): ChartSvg | null {
  const cut = cutoff(years);
  const pts: number[] = []; const months: string[] = []; const ex: number[] = [];
  let curM: string | null = null;
  for (let i = 0; i < dates.length; i++) {
    const v = values[i];
    if (dates[i] < cut || v == null) continue;
    const m = dates[i].slice(0, 7);
    if (m !== curM) { pts.push(v); months.push(m); if (prices) ex.push(prices[i]); curM = m; }
    else { pts[pts.length - 1] = v; if (prices) ex[ex.length - 1] = prices[i]; }
  }
  if (pts.length < 2) return null;

  const f: Frame = { w: 460, h: 118, l: 34, r: 14, t: 10, b: 20 };
  const x = (i: number) => f.l + (f.w - f.l - f.r) * i / (pts.length - 1);
  const y = (v: number) => f.t + (f.h - f.t - f.b) * (1 - v);

  let g = gridLine(f, y(0), '0') + gridLine(f, y(0.5), '0,5') + gridLine(f, y(1), '1');
  // Nur wo die Metrik wirklich Zonen kennt. Währungen haben keine — dort wären die
  // Linien samt Beschriftung eine Behauptung, die der Seitentext ausdrücklich verneint.
  // Die Schwellen kommen von der Metrik, weil sie je nach Kennzahl anders liegen.
  if (bands) {
    g += dashedLine(f, y(bands[0]), PALETTE.lo, '3 4', '.55') + dashedLine(f, y(bands[1]), PALETTE.hi, '3 4', '.55');
  }
  g += yearMarks(f, months, x);
  g += drawnLine(f, pts.length, x, i => y(pts[i]), color, fmt(pts[pts.length - 1], 2));
  g += caption(f, `${label} · ${years} Jahre${bands ? ` · gestrichelt: Kauf ${fmt(bands[0], 2)} / Warnung ${fmt(bands[1], 2)}` : ''}`);

  return {
    svg: svgDoc(f, `${label}-Verlauf, letzte ${years} Jahre`, g),
    tip: {
      m: months.map(monat), v: pts.map(v => +v.toFixed(3)),
      p: prices ? ex.map(v => +v.toFixed(dec)) : null, l: label, u: unit, frame: f,
    },
  };
}

export interface PriceChartOptions {
  months: string[];
  prices: number[];
  color: string;
  label?: string;
  unit?: string;
  dec?: number;
  years?: number;
}

/** Kursverlauf in Originalwährung. Anders als der Heat-Chart hat er keine feste 0…1-Achse,
 *  sondern skaliert sich selbst — bei mehr als einer Größenordnung Spanne logarithmisch,
 *  weil ein Korb, der sich verzehnfacht hat, linear nur noch als flache Linie am Boden läge. */
export function priceSparklineSvg({
  months, prices, color, label = 'Kurs', unit = '$', dec = 0, years = DEFAULT_YEARS,
}: PriceChartOptions): ChartSvg | null {
  // Monatsgenau vergleichen: Der angebrochene erste Monat bleibt sichtbar.
  const cut = cutoff(years).slice(0, 7);
  const pts: number[] = []; const ms: string[] = [];
  for (let i = 0; i < months.length; i++) {
    const p = prices[i];
    // series.months liefert volle Datumsangaben (2020-10-01). Erst auf YYYY-MM kürzen,
    // sonst endet jeder Eintrag auf '-01' und die Jahresmarke stünde an jedem Monat.
    const ym = months[i].slice(0, 7);
    if (ym < cut || p == null || !isFinite(p)) continue;
    pts.push(p); ms.push(ym);
  }
  if (pts.length < 2) return null;

  const lo = Math.min(...pts), hi = Math.max(...pts);
  // Log-Skala nur bei durchweg positiven Reihen — Kennzahlen wie der MVRV-Z-Score
  // werden negativ, dort ist sie weder definiert noch sinnvoll.
  const log = lo > 0 && hi / lo > 8;
  const tr = (v: number) => (log ? Math.log(v) : v);
  const tLo = tr(lo), tHi = tr(hi);
  const span = tHi - tLo || 1;
  // 4 % Luft oben und unten, damit Hoch- und Tiefpunkt nicht am Rahmen kleben
  const norm = (v: number) => 0.04 + 0.92 * ((tr(v) - tLo) / span);

  const f: Frame = { w: 460, h: 118, l: 46, r: 14, t: 10, b: 20 };
  const x = (i: number) => f.l + (f.w - f.l - f.r) * i / (pts.length - 1);
  const y = (v: number) => f.t + (f.h - f.t - f.b) * (1 - norm(v));

  const mid = log ? Math.sqrt(lo * hi) : (lo + hi) / 2;
  let g = [lo, mid, hi].map(v => gridLine(f, y(v), fmt(v, dec))).join('');
  // Nulllinie hervorheben, wo die Reihe das Vorzeichen wechselt — beim MVRV-Z-Score
  // markiert sie den Punkt, an dem der Markt unter den Einstand seiner Halter fällt.
  if (lo < 0 && hi > 0) g += dashedLine(f, y(0), PALETTE.faint, '3 3');
  g += yearMarks(f, ms, x);
  g += drawnLine(f, pts.length, x, i => y(pts[i]), color, fmt(pts[pts.length - 1], dec));
  g += caption(f, `${label} · ${years} Jahre${log ? ' · log. Skala' : ''}`);

  return {
    svg: svgDoc(f, `${label}-Verlauf, letzte ${years} Jahre`, g),
    tip: { m: ms.map(monat), v: pts.map(norm), p: pts.map(v => +v.toFixed(dec)), l: label, u: unit, f: 'none', frame: f },
  };
}

/** Bärenmarkt-Chart aus vorberechnetem Zyklus (Snapshot): Kurs in % des Allzeithochs über Tage seitdem. */
export function bearChartSvg(cy: BearCycle, gid: string, maxDays: number, todayDay: number | null): ChartSvg {
  const f: Frame = { w: 460, h: 150, l: 36, r: 14, t: 18, b: 24 };
  const days = cy.days; const vals = cy.pct; const color = cy.hex;
  const x = (d: number) => f.l + (f.w - f.l - f.r) * d / maxDays;
  const y = (v: number) => f.t + (f.h - f.t - f.b) * (1 - v);
  let g = '';
  ([[1, '100%'], [0.75, ''], [0.5, '50%'], [0.25, ''], [0, '0%']] as [number, string][]).forEach(([v, t]) => {
    g += `<line x1="${f.l}" x2="${f.w - f.r}" y1="${y(v)}" y2="${y(v)}" stroke="${PALETTE.line}" stroke-width="1" ${t ? '' : 'opacity=".5"'}/>`
      + (t ? `<text x="${f.l - 6}" y="${y(v) + 3}" text-anchor="end">${t}</text>` : '');
  });
  [90, 180, 270, 360].filter(d => d < maxDays - 20).forEach(d => {
    g += `<line x1="${x(d)}" x2="${x(d)}" y1="${y(1)}" y2="${y(0)}" stroke="${PALETTE.line}" opacity=".55"/>
        <text x="${x(d)}" y="${f.h - 8}" text-anchor="middle">Tag ${d}</text>`;
  });
  const path = days.map((dd, i) => `${i ? 'L' : 'M'}${x(dd).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(' ');
  g += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".22"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${path} L${x(days[days.length - 1]).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z" fill="url(#${gid})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.8"/>`;
  if (todayDay != null && todayDay <= maxDays) {
    const tx = x(todayDay);
    const anchor = tx > f.w - 95 ? 'end' : tx < f.l + 70 ? 'start' : 'middle';
    g += `<line x1="${tx}" x2="${tx}" y1="${y(1) - 4}" y2="${y(0)}" stroke="${PALETTE.mid}" stroke-width="1.2" stroke-dasharray="4 3"/>
        <text x="${tx + (anchor === 'end' ? -5 : anchor === 'start' ? 5 : 0)}" y="${f.t - 6}" text-anchor="${anchor}" style="fill:${PALETTE.mid}">heute · Tag ${todayDay}</text>`;
  }
  let bi = 0; vals.forEach((v, i) => { if (v < vals[bi]) bi = i; });
  const px = x(days[bi]), py = y(vals[bi]);
  const right = px > f.w - 120, low = py > f.h - f.b - 20;
  g += `<circle cx="${px}" cy="${py}" r="3.6" fill="${color}" stroke="${PALETTE.ink}" stroke-width="1.5"/>
      <text x="${px + (right ? -8 : 8)}" y="${low ? py - 9 : py + 15}" text-anchor="${right ? 'end' : 'start'}"
        style="fill:${color};font-weight:600">Tief: ${Math.round(100 * (vals[bi] - 1))} % · Tag ${days[bi]}</text>`;
  return {
    svg: svgDoc(f, 'Bärenmarkt-Verlauf', g),
    tip: {
      m: days.map((dd, i) => `Tag ${dd} · ${datum(cy.dates[i])}`),
      v: vals, p: cy.prices, l: 'vom Allzeithoch', u: '$', f: 'pct',
      s: days[days.length - 1] / maxDays, frame: f,
    },
  };
}
