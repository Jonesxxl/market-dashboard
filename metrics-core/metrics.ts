/** metrics-core · Registry. Eine neue Metrik = ein neuer Eintrag hier — Snapshot, Report und
 *  Generator sehen sie automatisch. */
import { computeHeat, computeIndicator, computeRisk, defaultSignal, fmt, RISK_CONSTANTS } from './math';
import { fetchBtcMvrvZ, fetchCrypto, fetchCryptoBasket, fetchMarket } from './sources';
import { MetricDefinition, MetricResult, Row } from './types';

const round = (n: number) => Math.round(n);

/* ===== Klartext-Bausteine ===== */
function heatInterpret(label: string, r: MetricResult, seitJahr: string): string {
  const h = r.current.value;
  const base = h < 0.5
    ? `Nur an <b>${round(h * 100)} %</b> aller Handelstage seit ${seitJahr} lag ${label} noch weiter <b>unter</b> seinem 200-Tage-Durchschnitt als heute.`
    : `An <b>${round((1 - h) * 100)} %</b> aller Handelstage seit ${seitJahr} lag ${label} noch weiter <b>über</b> seinem 200-Tage-Durchschnitt als heute.`;
  return base + (h < 0.15 ? ' Das ist die <b>Kaufzone</b> — solche Extreme waren historisch selten und hielten nicht lange.'
    : h > 0.85 ? ' Das ist die <b>Warnzone</b> — der Kurs ist heißgelaufen.' : '');
}

function riskInterpret(sym: string, r: MetricResult): string {
  const v = r.current.value;
  return v < 0.1 ? `${sym} notiert auf <b>historischem Bodenniveau</b> — vergleichbar mit den Zyklustiefs, an denen langfristige Käufe bisher am besten funktioniert haben.`
    : v < 0.2 ? `${sym} ist <b>historisch günstig</b> bewertet relativ zum eigenen Langfristtrend — aber noch ohne Kapitulations-Extrem. Zone für gestaffelte Käufe.`
    : v < 0.5 ? `${sym} liegt im <b>neutralen Bereich</b> — weder auffällig billig noch teuer relativ zum eigenen Trend.`
    : `${sym} ist <b>heißgelaufen</b> — in dieser Zone lagen historisch die Zyklustops, nicht die Einstiege.`;
}

function fxInterpret(up: string, down: string, r: MetricResult, seitJahr: string): string {
  const h = r.current.value;
  const abw = 100 * (r.current.price / r.current.sma - 1);
  return `${abw >= 0 ? up : down} Der Kurs liegt <b>${fmt(Math.abs(abw), 1)} % ${abw >= 0 ? 'über' : 'unter'}</b> dem 200-Tage-Schnitt — ${h < 0.5
    ? 'nur an <b>' + round(h * 100) + ' %</b> aller Tage seit ' + seitJahr + ' war die Abweichung nach unten noch größer.'
    : 'nur an <b>' + round((1 - h) * 100) + ' %</b> aller Tage seit ' + seitJahr + ' war die Abweichung nach oben noch größer.'}${h < 0.15 || h > 0.85 ? ' <b>Gedehnte Bewegung</b> — solche Extreme schwangen historisch oft zurück.' : ''}`;
}

const RISK_LEVELS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];

/* ===== Krypto ===== */
const crypto: MetricDefinition[] = [
  {
    id: 'btc-risk', label: 'Bitcoin', sym: 'BTC', assetClass: 'crypto', kind: 'risk',
    unit: '$', dec: 0, hex: '#E8963C',
    /* Schwellen der v2-Kalibrierung. Abgeleitet, nicht geraten: Die obere Stufe liegt auf
       der gestrichelten Kauflinie (0,30 — trifft 17,1 % aller Tage), die beiden unteren
       bilden dieselbe Kaskadenform wie unter v1 nach (4,6 % und 1,1 % gegenüber früher
       10 %, 3,5 % und 0,8 %). */
    zones: [
      { label: 'Basisrate', text: '< 0.30', below: 0.30 },
      { label: 'Rate erhöhen', text: '< 0.20', below: 0.20 },
      { label: 'Kapitulation', text: '< 0.15', below: 0.15 },
    ],
    hotAbove: 0.70,
    fetch: ctx => fetchCrypto('btc', 'bitcoin', 'BTC-USD', ctx),
    compute: rows => computeRisk(rows, 'btc'),
    interpret: r => riskInterpret('BTC', r),
    extra: r => ({
      riskLevels: RISK_LEVELS.map(lv => ({ r: lv, price: Math.round(r.priceForValue!(lv)) })),
      smaDays: RISK_CONSTANTS['btc'].W,
      chartBands: [0.30, 0.70],
      // Aus der v2-Kalibrierung neu bestimmt. Die Böden 2015, 2018 und 2022 liegen mit
      // 0.099/0.110/0.091 so dicht beieinander, dass getrennte Marken sich überlappen.
      ghosts: [
        { r: 0.10, t: 'Böden 15/18/22' },
        { r: 0.56, t: 'ATH 25' }, { r: 0.88, t: 'ATH 21' },
      ],
    }),
  },
  {
    id: 'eth-risk', label: 'Ethereum', sym: 'ETH', assetClass: 'crypto', kind: 'risk',
    unit: '$', dec: 0, hex: '#8A7BF0',
    /* Ethereum steht weiter auf der v1-Kalibrierung — ohne Referenzpunkte wäre jede
       Neuberechnung geraten. Angeglichen ist nur die obere Stufe, damit sie wie bei
       Bitcoin auf der gestrichelten Kauflinie sitzt. */
    zones: [
      { label: 'Kleine Tranchen', text: '< 0.30', below: 0.30 },
      { label: 'Rate erhöhen', text: '< 0.10', below: 0.10 },
      { label: 'Kapitulation', text: '< 0.05', below: 0.05 },
    ],
    hotAbove: 0.70,
    fetch: ctx => fetchCrypto('eth', 'ethereum', 'ETH-USD', ctx),
    compute: rows => computeRisk(rows, 'eth'),
    interpret: r => riskInterpret('ETH', r),
    extra: r => ({
      riskLevels: RISK_LEVELS.map(lv => ({ r: lv, price: Math.round(r.priceForValue!(lv)) })),
      smaDays: RISK_CONSTANTS['eth'].W,
      chartBands: [0.30, 0.70],
      ghosts: [
        { r: 0.00, t: 'Boden 18' }, { r: 0.09, t: 'Boden 22' },
        { r: 0.71, t: 'ATH 25' }, { r: 0.88, t: 'ATH 18' },
      ],
    }),
  },
];

/** MVRV-Z-Score: Wie weit liegt der Börsenwert aller Bitcoin über dem Preis, den ihre Besitzer
 *  im Schnitt bezahlt haben — gemessen in Standardabweichungen des Börsenwerts. Anders als der
 *  Risk-Wert stützt er sich auf On-Chain-Daten statt allein auf den Kursverlauf. */
crypto.push({
  id: 'btc-mvrv-z',
  label: 'Bitcoin · Börsenwert gegen Einstand der Halter (MVRV-Z-Score)',
  sym: 'MVRV-Z', assetClass: 'crypto', kind: 'heat', unit: '', dec: 2, hex: '#E8963C',
  zones: [{ label: 'Kaufzone', text: '< 0.15', below: 0.15 }], hotAbove: 0.85,
  fetch: () => fetchBtcMvrvZ(),
  compute: rows => computeIndicator(rows),
  interpret: r => {
    const z = r.current.price;
    const p = r.current.value;
    const lage = z < 0
      ? `Der Börsenwert liegt <b>unter</b> dem Einstand der Halter — im Schnitt sitzt der Markt auf Verlusten. Dieser Zustand trat bisher nur in ausgeprägten Bärenmärkten ein.`
      : z < 1
        ? `Der Börsenwert liegt nur knapp über dem Einstand der Halter — historisch das Umfeld später Bärenmärkte und früher Erholungen.`
        : z < 3
          ? `Der Börsenwert liegt spürbar über dem Einstand der Halter, aber im Rahmen dessen, was über weite Strecken eines Zyklus normal war.`
          : `Der Börsenwert liegt <b>weit</b> über dem Einstand der Halter — dieses Niveau markierte in der Vergangenheit die späte Phase eines Zyklus.`;
    const perz = p < 0.5
      ? `Nur an <b>${round(p * 100)} %</b> aller Tage seit 2011 war der Wert noch niedriger.`
      : `Nur an <b>${round((1 - p) * 100)} %</b> aller Tage seit 2011 war der Wert noch höher.`;
    return `Der MVRV-Z-Score vergleicht den Börsenwert aller Bitcoin mit dem <b>Realized Value</b> — der Summe `
      + `dessen, was zuletzt für jede Münze bezahlt wurde — und drückt den Abstand in Standardabweichungen aus. `
      + `Aktuell <b>${fmt(z, 2)}</b>. ${lage} ${perz}`
      + (p < 0.15 ? ' Das ist die <b>Kaufzone</b>.' : p > 0.85 ? ' Das ist die <b>Warnzone</b>.' : '');
  },
  extra: () => ({
    priceChart: true,
    priceLabel: 'Z-Score',
    valueLabel: 'Perzentil · 0 = historisch niedrigster Z-Score · 1 = historisch höchster',
    hideAth: true,
    priceNote: 'Die Zyklushochs fallen von Mal zu Mal niedriger aus (2013: 10,7 · 2017: 10,1 · 2021: 7,2 · '
      + '2024: 3,4). Feste Schwellen wie „über 7 heißt Top" greifen deshalb nicht mehr. Auch das Perzentil '
      + 'darüber löst das nur teilweise, denn es gewichtet alte Zyklen genauso stark wie neue.',
  }),
});

/** Top-Holdings des S&P Pantera Digital Asset Index (Launch 21.07.2026). Aufgenommen wird,
 *  was ≥ ~4 Jahre Historie hat — SOL/HYPE wachsen automatisch hinein, sobald Coin Metrics
 *  sie rückwirkend befüllt. Der offizielle Index hat noch keinen frei abrufbaren Feed. */
const DAI_TOP_HOLDINGS: [string, string, string?][] = [
  ['eth', 'ethereum', 'ETH-USD'], ['bnb', 'binancecoin', 'BNB-USD'], ['sol', 'solana', 'SOL-USD'],
  ['trx', 'tron', 'TRX-USD'], ['hype', 'hyperliquid'],
];
crypto.push({
  id: 'dai-basket-heat',
  label: 'Digital-Asset-Basket · Anlehnung S&P Pantera Digital Asset Index',
  sym: 'DAI-Proxy', assetClass: 'crypto', kind: 'heat', unit: '$', dec: 0, hex: '#6FCF97',
  zones: [{ label: 'Kaufzone', text: '< 0.15', below: 0.15 }], hotAbove: 0.85,
  /** Der Korb ist ein gleichgewichteter Index ohne eigenen Marktpreis. Damit er trotzdem
   *  einen lesbaren Dollar-Verlauf bekommt, wird der auf 1 normierte Index mit 100 skaliert:
   *  die Kurve zeigt dann den Wert von 100 $, am Startdatum gleichgewichtet investiert.
   *  Der Heat-Wert bleibt davon unberührt, denn ln(kP / kSMA) = ln(P / SMA). */
  fetch: async ctx => (await fetchCryptoBasket(DAI_TOP_HOLDINGS, 1500, ctx))
    .map(([d, p]) => [d, p * 100] as Row),
  compute: rows => computeHeat(rows),
  /* Kein Datum in der Notiz: `r.dates[0]` ist der Beginn der Heat-Reihe und liegt 200
     Handelstage nach der Normierung — dort steht der Index längst über 100. */
  extra: r => ({
    priceChart: true,
    priceNote: `Gleichgewichteter Index ohne eigenen Marktpreis: 100 $ entsprechen dem Stand am `
      + `ersten Tag der gemeinsamen Kurshistorie aller Korbmitglieder — heute rund `
      + `${fmt(r.current.price / 100, 1)} ×.`,
  }),
  interpret: r => {
    const h = r.current.value;
    const base = h < 0.5
      ? `Nur an <b>${round(h * 100)} %</b> aller Tage lag der Korb noch weiter <b>unter</b> seinem 200-Tage-Trend als heute.`
      : `An <b>${round((1 - h) * 100)} %</b> aller Tage lag der Korb noch weiter <b>über</b> seinem 200-Tage-Trend als heute.`;
    return `Gleichgewichteter Korb der datenreichen Top-Holdings des S&P Pantera Digital Asset Index `
      + `(ohne Bitcoin, Revenue-gescreent; der offizielle Index von Juli 2026 hat noch keinen freien Datenfeed `
      + `und zu wenig Historie für Perzentile — dieser Proxy bildet seine größten Mitglieder ab). ${base}`
      + (h < 0.15 ? ' <b>Kaufzone.</b>' : h > 0.85 ? ' <b>Warnzone — heißgelaufen.</b>' : '');
  },
});

/* ===== Metalle ===== */
const kaufzone = [{ label: 'Kaufzone', text: '< 0.15', below: 0.15 }];
const metalDef = (id: string, label: string, sym: string, hex: string, y: string, s: string): MetricDefinition => ({
  id, label, sym, assetClass: 'metal', kind: 'heat', unit: '$/oz', dec: 0, hex,
  zones: kaufzone, hotAbove: 0.85,
  fetch: ctx => fetchMarket(ctx, y, s),
  compute: rows => computeHeat(rows),
  interpret: r => heatInterpret(label, r, r.dates[0].slice(0, 4)),
});
const metals: MetricDefinition[] = [
  metalDef('gold-heat', 'Gold', 'XAU/USD', '#E3C05A', 'GC=F', 'xauusd'),
  metalDef('silver-heat', 'Silber', 'XAG/USD', '#B8C4D4', 'SI=F', 'xagusd'),
  metalDef('pall-heat', 'Palladium', 'XPD/USD', '#7FD0C9', 'PA=F', 'xpdusd'),
];

/* ===== Aktien / Kredit ===== */
const equity: MetricDefinition[] = [
  {
    id: 'ndx-heat', label: 'Nasdaq 100', sym: '^NDX', assetClass: 'equity', kind: 'heat',
    unit: 'Pkt.', dec: 0, hex: '#5FA8F5', zones: kaufzone, hotAbove: 0.85,
    fetch: ctx => fetchMarket(ctx, '^NDX', '^ndq'),
    compute: rows => computeHeat(rows),
    interpret: r => {
      const abw = 100 * (r.current.price / r.current.sma - 1);
      const h = r.current.value;
      return `Der Nasdaq 100 notiert <b>${fmt(Math.abs(abw), 1)} % ${abw >= 0 ? 'über' : 'unter'}</b> seinem 200-Tage-Durchschnitt. Heat ${h.toFixed(2)} heißt: ${h < 0.5
        ? 'Nur an ' + round(h * 100) + ' % aller Tage seit 1985 war er noch tiefer unter Trend.'
        : 'An nur ' + round((1 - h) * 100) + ' % aller Tage seit 1985 war er noch weiter über Trend.'}`;
    },
  },
  {
    id: 'conc-heat', label: 'Konzentration · S&P 500 kapitalgewichtet ÷ gleichgewichtet (SPY/RSP)',
    sym: 'SPY/RSP', assetClass: 'equity', kind: 'heat', unit: '', dec: 3, hex: '#F2B33D',
    zones: kaufzone, hotAbove: 0.85,
    fetch: async ctx => {
      const { ratioSeries } = await import('./math');
      const [a, b] = await Promise.all([fetchMarket(ctx, 'SPY', 'spy.us'), fetchMarket(ctx, 'RSP', 'rsp.us')]);
      return ratioSeries(a, b);
    },
    compute: rows => computeHeat(rows),
    interpret: r => `Steigt diese Kurve, wachsen die größten Konzerne schneller als der Rest des Index — der Markt hängt an immer weniger Aktien. Genau diese Konzentration war ein Kennzeichen von 2000. ${r.current.value > 0.85 ? '<b>Aktuell im historischen Extrembereich.</b>' : r.current.value < 0.15 ? 'Aktuell historisch niedrig — der breite Markt trägt mit.' : 'Aktuell im normalen Bereich.'}`,
  },
  {
    id: 'credit-heat', label: 'Kredit-Risikoappetit · Hochzins- ÷ Qualitätsanleihen (HYG/LQD)',
    sym: 'HYG/LQD', assetClass: 'credit', kind: 'heat', unit: '', dec: 3, hex: '#22C6B8',
    zones: kaufzone, hotAbove: 0.85,
    fetch: async ctx => {
      const { ratioSeries } = await import('./math');
      const [a, b] = await Promise.all([fetchMarket(ctx, 'HYG', 'hyg.us'), fetchMarket(ctx, 'LQD', 'lqd.us')]);
      return ratioSeries(a, b);
    },
    compute: rows => computeHeat(rows),
    interpret: r => `Steigt diese Kurve, greifen Anleger sorglos zu riskanten Anleihen — enge Credit Spreads, viel Risikoappetit. Fällt sie, verlangt der Anleihemarkt wieder Risikoprämien: historisch eines der frühesten Warnsignale vor Aktien-Tops. ${r.current.value > 0.85 ? '<b>Aktuell maximale Sorglosigkeit.</b>' : r.current.value < 0.15 ? '<b>Aktuell Stress im Kreditmarkt</b> — Vorsicht bei Aktien.' : 'Aktuell unauffällig.'}`,
  },
];

/* ===== Währungen =====
 * Alle Paare notieren den Dollar als Basiswährung: ein steigender Kurs bedeutet
 * durchgehend einen stärkeren Dollar. Yahoo und Stooq liefern EUR/USD in der
 * umgekehrten Konvention, deshalb wird dieses eine Paar invertiert (`invert: true`).
 * Für den Heat-Wert ist das kein kosmetischer Eingriff: ln(1/P ÷ SMA200(1/P)) ist
 * nicht das negierte ln(P ÷ SMA200(P)), das Perzentil wird also neu berechnet. */
const fxDef = (id: string, label: string, sym: string, hex: string, y: string, s: string,
  dec: number, up: string, down: string, invert = false): MetricDefinition => ({
  id, label, sym, assetClass: 'fx', kind: 'heat', unit: '', dec, hex,
  zones: [], hotAbove: null,
  fetch: async ctx => {
    const rows = await fetchMarket(ctx, y, s);
    return invert ? rows.filter(([, p]) => p > 0).map(([d, p]) => [d, 1 / p] as Row) : rows;
  },
  compute: rows => computeHeat(rows),
  interpret: r => fxInterpret(up, down, r, r.dates[0].slice(0, 4)),
  // Der Heat-Wert allein zeigt nur, wie ungewöhnlich der Stand ist — nicht, wo der Kurs
  // steht. Bei Währungen ist genau das die Frage, deshalb hier immer der Kursverlauf dazu.
  extra: () => ({ priceChart: true }),
});
const fx: MetricDefinition[] = [
  fxDef('dxy', 'Dollar-Index', 'DXY', '#5FA8F5', 'DX-Y.NYB', '^dxy', 1,
    'Der Dollar gewinnt gegen den Korb der großen Währungen (EUR, JPY, GBP, …).',
    'Der Dollar verliert breit gegen die großen Währungen.'),
  fxDef('usdeur', 'US-Dollar / Euro', 'USD/EUR', '#F2B33D', 'EURUSD=X', 'eurusd', 4,
    'Der Dollar ist stark zum Euro — für Anleger im Euroraum verteuern sich Dollar-Anlagen.',
    'Der Dollar ist schwach zum Euro — Dollar-Anlagen sind aus Euro-Sicht günstiger.', true),
  fxDef('usdchf', 'US-Dollar / Schweizer Franken', 'USD/CHF', '#F0533F', 'CHF=X', 'usdchf', 4,
    'Der Franken schwächelt — ungewöhnlich, er ist die klassische Fluchtwährung.',
    'Der Franken ist stark — typisch in Stressphasen (sicherer Hafen).'),
  fxDef('usdcny', 'US-Dollar / Chinesischer Yuan', 'USD/CNY', '#F06FA8', 'CNY=X', 'usdcny', 3,
    'Der Yuan wertet ab — oft gesteuert, wirkt wie ein Ventil für Chinas Exportwirtschaft.',
    'Der Yuan wertet auf gegenüber dem Dollar.'),
  fxDef('usdghs', 'US-Dollar / Ghana Cedi', 'USD/GHS', '#7FD0C9', 'GHS=X', 'usdghs', 2,
    'Der Cedi verliert an Wert — bei Frontier-Währungen meist Inflations- und Schuldensignal.',
    'Der Cedi stabilisiert sich gegen den Dollar.'),
  // Einziges Kreuzpaar ohne Dollar: Wie viele Euro kostet ein Franken. Steigt die Kurve,
  // ist der Franken stark — die Dollar-Leserichtung der übrigen Paare gilt hier also nicht.
  fxDef('chfeur', 'Schweizer Franken / Euro', 'CHF/EUR', '#B8C4D4', 'CHFEUR=X', 'chfeur', 4,
    'Der Franken ist stark zum Euro — Schweizer Waren und Anlagen verteuern sich aus Euro-Sicht.',
    'Der Franken gibt gegenüber dem Euro nach — für den Franken historisch die seltenere Richtung.'),
];

/** Die Registry: Snapshot-Builder, Report und Generator iterieren hierüber. */
export const REGISTRY: MetricDefinition[] = [...crypto, ...metals, ...equity, ...fx];

export { defaultSignal };
