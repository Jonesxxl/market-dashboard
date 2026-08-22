import { fmt } from '../../../metrics-core/math';
import { BearCycle } from '../../../metrics-core/types';

export interface TipData {
  m: string[]; v: number[]; p: number[] | null; l: string; u: string;
  /** 'pct' zeigt v als Prozent, 'none' blendet v aus (dann trägt p den Wert). */
  f?: 'pct' | 'none';
  s?: number; hh?: number; ht?: number; hb?: number;
}

/** Verlaufschart (monatlich, mit Achsenskala, Schwellenlinien, Endwert). */
export function sparklineSvg(
  dates: string[], vals: (number | null)[], color: string,
  years = 6, label = 'Heat', extra: number[] | null = null, unit = '',
  dec = 2, zoneLines = true,
): { svg: string; tip: TipData } | null {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - years);
  const cut = cutoff.toISOString().slice(0, 10);
  const pts: number[] = []; const months: string[] = []; const ex: number[] = [];
  let curM: string | null = null;
  for (let i = 0; i < dates.length; i++) {
    const v = vals[i];
    if (dates[i] < cut || v == null) continue;
    const m = dates[i].slice(0, 7);
    if (m !== curM) { pts.push(v); months.push(m); if (extra) ex.push(extra[i]); curM = m; }
    else { pts[pts.length - 1] = v; if (extra) ex[ex.length - 1] = extra[i]; }
  }
  if (pts.length < 2) return null;
  const W = 460, H = 118, L = 34, R = 14, T = 10, B = 20;
  const x = (i: number) => L + (W - L - R) * i / (pts.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v);
  let g = '';
  ([[0, '0'], [0.5, '0.5'], [1, '1']] as [number, string][]).forEach(([v, t]) => {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#1D2A42" stroke-width="1"/>
        <text x="${L - 5}" y="${y(v) + 3}" text-anchor="end">${t}</text>`;
  });
  // Nur wo die Metrik wirklich Zonen kennt. Währungen haben keine — dort wären die
  // Linien samt Beschriftung eine Behauptung, die der Seitentext ausdrücklich verneint.
  if (zoneLines) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(0.15)}" y2="${y(0.15)}" stroke="#22C6B8" stroke-width="1" stroke-dasharray="3 4" opacity=".55"/>
      <line x1="${L}" x2="${W - R}" y1="${y(0.85)}" y2="${y(0.85)}" stroke="#F0533F" stroke-width="1" stroke-dasharray="3 4" opacity=".55"/>`;
  }
  months.forEach((m, i) => {
    if (m.endsWith('-01'))
      g += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(1)}" y2="${y(0)}" stroke="#1D2A42" opacity=".6"/>
        <text x="${x(i)}" y="${H - 6}" text-anchor="middle">${m.slice(0, 4)}</text>`;
  });
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lx = x(pts.length - 1), ly = y(pts[pts.length - 1]);
  g += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8"/>
      <circle cx="${lx}" cy="${ly}" r="3.2" fill="${color}"/>
      <text x="${Math.min(lx + 5, W - R)}" y="${ly < T + 14 ? ly + 14 : ly - 6}" text-anchor="end" style="fill:${color};font-weight:600">${pts[pts.length - 1].toFixed(2)}</text>
      <text x="${W - R}" y="${T + 2}" text-anchor="end">${label} · ${years} Jahre${zoneLines ? ' · gestrichelt: Kauf-/Warnzone' : ''}</text>`;
  const svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="${label}-Verlauf, letzte ${years} Jahre">${g}</svg>`;
  const tip: TipData = {
    m: months, v: pts.map(v => +v.toFixed(3)),
    p: extra ? ex.map(v => +v.toFixed(dec)) : null, l: label, u: unit,
  };
  return { svg, tip };
}

/** Kursverlauf in Originalwährung. Anders als der Heat-Chart hat er keine feste 0…1-Achse,
 *  sondern skaliert sich selbst — bei mehr als einer Größenordnung Spanne logarithmisch,
 *  weil ein Korb, der sich verzehnfacht hat, linear nur noch als flache Linie am Boden läge. */
export function priceSparklineSvg(
  months: string[], prices: number[], color: string,
  years = 6, label = 'Kurs', unit = '$', dec = 0,
): { svg: string; tip: TipData } | null {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - years);
  const cut = cutoff.toISOString().slice(0, 7);
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

  const W = 460, H = 118, L = 46, R = 14, T = 10, B = 20;
  const x = (i: number) => L + (W - L - R) * i / (pts.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - norm(v));

  let g = '';
  const mid = log ? Math.sqrt(lo * hi) : (lo + hi) / 2;
  for (const v of [lo, mid, hi]) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#1D2A42" stroke-width="1"/>
        <text x="${L - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${fmt(v, dec)}</text>`;
  }
  // Nulllinie hervorheben, wo die Reihe das Vorzeichen wechselt — beim MVRV-Z-Score
  // markiert sie den Punkt, an dem der Markt unter den Einstand seiner Halter fällt.
  if (lo < 0 && hi > 0) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="#5A667E" stroke-width="1" stroke-dasharray="3 3"/>`;
  }
  ms.forEach((m, i) => {
    if (m.endsWith('-01'))
      g += `<line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${T}" y2="${H - B}" stroke="#1D2A42" opacity=".6"/>
        <text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${m.slice(0, 4)}</text>`;
  });

  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lx = x(pts.length - 1), ly = y(pts[pts.length - 1]);
  g += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8"/>
      <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.2" fill="${color}"/>
      <text x="${Math.min(lx + 5, W - R)}" y="${ly < T + 14 ? ly + 14 : ly - 6}" text-anchor="end" style="fill:${color};font-weight:600">${fmt(pts[pts.length - 1], dec)}</text>
      <text x="${W - R}" y="${T + 2}" text-anchor="end">${label} · ${years} Jahre${log ? ' · log. Skala' : ''}</text>`;

  const svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="${label}-Verlauf, letzte ${years} Jahre">${g}</svg>`;
  const tip: TipData = {
    m: ms, v: pts.map(norm), p: pts.map(v => +v.toFixed(dec)),
    l: label, u: unit, f: 'none',
  };
  return { svg, tip };
}

/** Bärenmarkt-Chart aus vorberechnetem Zyklus (Snapshot): Kurs in % des ATH über Tage seit ATH. */
export function bearChartSvg(
  cy: BearCycle, gid: string, maxDays: number, todayDay: number | null,
): { svg: string; tip: TipData } {
  const W = 460, H = 150, L = 36, R = 14, T = 18, B = 24;
  const days = cy.days; const vals = cy.pct; const color = cy.hex;
  const x = (d: number) => L + (W - L - R) * d / maxDays;
  const y = (v: number) => T + (H - T - B) * (1 - v);
  let g = '';
  ([[1, '100%'], [0.75, ''], [0.5, '50%'], [0.25, ''], [0, '0%']] as [number, string][]).forEach(([v, t]) => {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#1D2A42" stroke-width="1" ${t ? '' : 'opacity=".5"'}/>`
      + (t ? `<text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${t}</text>` : '');
  });
  [90, 180, 270, 360].filter(d => d < maxDays - 20).forEach(d => {
    g += `<line x1="${x(d)}" x2="${x(d)}" y1="${y(1)}" y2="${y(0)}" stroke="#1D2A42" opacity=".55"/>
        <text x="${x(d)}" y="${H - 8}" text-anchor="middle">Tag ${d}</text>`;
  });
  const path = days.map((dd, i) => `${i ? 'L' : 'M'}${x(dd).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(' ');
  g += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".22"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${path} L${x(days[days.length - 1]).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z" fill="url(#${gid})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.8"/>`;
  if (todayDay != null && todayDay <= maxDays) {
    const tx = x(todayDay);
    const anchor = tx > W - 95 ? 'end' : tx < L + 70 ? 'start' : 'middle';
    g += `<line x1="${tx}" x2="${tx}" y1="${y(1) - 4}" y2="${y(0)}" stroke="#F2B33D" stroke-width="1.2" stroke-dasharray="4 3"/>
        <text x="${tx + (anchor === 'end' ? -5 : anchor === 'start' ? 5 : 0)}" y="${T - 6}" text-anchor="${anchor}" style="fill:#F2B33D">heute · Tag ${todayDay}</text>`;
  }
  let bi = 0; vals.forEach((v, i) => { if (v < vals[bi]) bi = i; });
  const px = x(days[bi]), py = y(vals[bi]);
  const right = px > W - 120, low = py > H - B - 20;
  g += `<circle cx="${px}" cy="${py}" r="3.6" fill="${color}" stroke="#0B1220" stroke-width="1.5"/>
      <text x="${px + (right ? -8 : 8)}" y="${low ? py - 9 : py + 15}" text-anchor="${right ? 'end' : 'start'}"
        style="fill:${color};font-weight:600">Tief: ${Math.round(100 * (vals[bi] - 1))} % · Tag ${days[bi]}</text>`;
  const svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Bärenmarkt-Verlauf">${g}</svg>`;
  const tip: TipData = {
    m: days.map((dd, i) => `Tag ${dd} · ${cy.dates[i]}`),
    v: vals,
    p: cy.prices,
    l: 'vom ATH', u: '$', f: 'pct',
    s: days[days.length - 1] / maxDays, hh: H, ht: T, hb: B,
  };
  return { svg, tip };
}
