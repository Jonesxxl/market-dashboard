/**
 * Erzeugt nach dem Angular-Build für jede Route eine echte HTML-Datei mit Inhalt.
 *
 * Hintergrund: Die Seite ist eine Client-SPA. Wer sie ohne JavaScript abruft — und das
 * tun GPTBot, ClaudeBot, PerplexityBot und OAI-SearchBot alle —, sah bisher 197 Zeichen
 * noscript-Text: keinen Wert, keine Überschrift, und /krypto war nicht von /metalle zu
 * unterscheiden. Auch Titel und Meta-Beschreibung setzte erst JavaScript.
 *
 * Dieser Generator schreibt den Seiteninhalt direkt in `<app-root>`. Angular leert das
 * Host-Element beim Bootstrap und übernimmt danach, der Inhalt ist also kein Duplikat,
 * sondern der Zustand vor dem Start — Crawler und erster Bildaufbau sehen dasselbe.
 *
 * Läuft nach `ng build`, liest den gebauten Shell und `public/snapshot.json`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { datum, fmt, formatValue, kindLabel, roundValue } from '../metrics-core/math';
import { HOME, ORIGIN, PAGES, PagePath } from '../metrics-core/site';
import { MetricSnapshot, Snapshot } from '../metrics-core/types';

const DIST = 'dist/macro-ng/browser';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Deutungstexte tragen <b>-Auszeichnung; die bleibt erhalten, alles andere wird entschärft. */
const richt = (s: string): string => esc(s).replace(/&lt;(\/?b)&gt;/g, '<$1>');
const wert = (m: MetricSnapshot): string => formatValue(m.kind, m.current.value);

interface Page {
  path: string; title: string; desc: string; h1: string; lead: string;
  metrics?: MetricSnapshot[]; extra?: string;
}

function tabelle(ms: MetricSnapshot[]): string {
  const zeilen = ms.map(m => `<tr>
      <td>${esc(m.label)}</td><td>${esc(m.sym)}</td><td>${wert(m)}</td>
      <td>${fmt(m.current.price, m.dec)}${m.unit ? ' ' + esc(m.unit) : ''}</td><td>${datum(m.current.date)}</td>
    </tr>`).join('\n    ');
  return `<table>
    <caption>Aktuelle Kennzahlen — Stand ${ms[0] ? datum(ms[0].current.date) : ''}</caption>
    <thead><tr><th>Kennzahl</th><th>Kürzel</th><th>Wert (0–1)</th><th>Kurs</th><th>Stand</th></tr></thead>
    <tbody>
    ${zeilen}
    </tbody>
  </table>`;
}

function deutungen(ms: MetricSnapshot[]): string {
  return ms.map(m => `<section>
    <h3>${esc(m.label)} — ${kindLabel(m.kind)} ${wert(m)}</h3>
    <p>${richt(m.interpret)}</p>
    <p>Kurs ${fmt(m.current.price, m.dec)}${m.unit ? ' ' + esc(m.unit) : ''} ·
       52-Wochen-Spanne ${fmt(m.stats.lo52, m.dec)}–${fmt(m.stats.hi52, m.dec)} ·
       Stand ${datum(m.current.date)}${m.current.staleDays > 3 ? ` (${m.current.staleDays} Tage alt)` : ''}.</p>
  </section>`).join('\n  ');
}

const METHODIK = `<section>
  <h2>Wie die Werte berechnet werden</h2>
  <p><strong>Heat</strong> ist das historische Perzentil des Abstands zwischen Kurs und
  200-Tage-Durchschnitt. Heat 0,10 bedeutet: Nur an 10 % aller Handelstage der verfügbaren
  Historie lag das Asset noch weiter unter seinem eigenen Trend als heute. Unter 0,15 gilt als
  Kaufzone, über 0,85 als Warnzone.</p>
  <p><strong>Risk</strong> (nur Bitcoin und Ethereum) ist min-max-normiertes
  ln(Kurs ÷ gleitender Durchschnitt) mal Tagesindex hoch einem Exponenten. Die Zeitgewichtung
  gleicht aus, dass die Ausschläge von Zyklus zu Zyklus kleiner werden. 0 entspricht dem Niveau
  historischer Zyklusböden, 1 dem Niveau historischer Zyklustops.</p>
  <p>Jedes Asset wird ausschließlich mit seiner eigenen Vergangenheit verglichen, nie mit einem
  anderen. Alle Werte werden alle zwei Tage vorberechnet; die Rohdaten liegen als
  <a href="/snapshot.json">snapshot.json</a> offen. Quellen: Coin Metrics und CoinGecko für
  Kryptowährungen, Yahoo Finance mit Stooq als Ersatzquelle für Edelmetalle, Aktien und Währungen.</p>
  <p><strong>Keine Anlageberatung.</strong> Die Kennzahlen sind statistische Auswertungen der
  Vergangenheit ohne Prognosecharakter.</p>
</section>`;

/** Titel und Beschreibung kommen aus metrics-core/site.ts — dieselben, die der Browser nach
 *  dem Start setzt. Datenseiten hängen den aktuellen Wert an, damit Suchen ihn schon im
 *  Snippet sehen. */
const meta = (path: PagePath, aktuell?: string): Pick<Page, 'path' | 'title' | 'desc'> => ({
  path, title: PAGES[path].title,
  desc: PAGES[path].description + (aktuell ? ` Aktuell: ${aktuell}.` : ''),
});

function seiten(snap: Snapshot): Page[] {
  const von = (ids: string[]) => ids.map(i => snap.metrics.find(m => m.id === i)).filter((m): m is MetricSnapshot => !!m);
  const klasse = (k: string) => snap.metrics.filter(m => m.assetClass === k);
  const b = snap.derived.bubble;

  const krypto = von(['btc-risk', 'eth-risk', 'btc-mvrv-z', 'dai-basket-heat']);
  const metalle = klasse('metal');
  const btc = krypto.find(m => m.id === 'btc-risk');
  const gold = metalle.find(m => m.id === 'gold-heat');
  const ki = [...klasse('equity'), ...klasse('credit')];
  const fx = klasse('fx');

  const ratioText = snap.derived.ratios.length ? `<section>
    <h2>Verhältnisse als Kontraindikator</h2>
    ${snap.derived.ratios.map(r => `<p><strong>${esc(r.title)}:</strong> aktuell ${fmt(r.cur, 2)},
      Median ${fmt(r.med, 2)}, Perzentil ${fmt(r.pct, 2)}. ${richt(r.note)}</p>`).join('\n    ')}
  </section>` : '';

  const bubbleText = b ? `<section>
    <h2>KI-Blasen-Score: ${fmt(b.score, 2)}</h2>
    <p>Der Score mittelt ${b.comps.length} Perzentile. Bestandteile:</p>
    <ul>${b.comps.map(c => `<li>${esc(c[0])}: ${fmt(c[1], 2)} — ${esc(c[2])}</li>`).join('')}</ul>
  </section>` : '';

  return [
    {
      path: '', title: HOME.title, desc: HOME.description,
      h1: 'Macro Risk Dashboard: Wie außergewöhnlich ist der heutige Kurs?',
      lead: 'Für Kryptowährungen, Edelmetalle, den Nasdaq 100 und die großen Währungen wird dieselbe Frage beantwortet: Wie weit liegt der Kurs über oder unter seinem langfristigen Trend — und an wie vielen Handelstagen der Vergangenheit war diese Abweichung noch größer? Weil jedes Asset nur an seiner eigenen Historie gemessen wird, sind die Ergebnisse untereinander vergleichbar.',
      metrics: snap.metrics,
    },
    {
      ...meta('krypto', btc ? `Bitcoin-Risk ${wert(btc)}` : undefined),
      h1: 'Krypto: Wie teuer sind Bitcoin und Ethereum gemessen an ihrer eigenen Geschichte?',
      lead: 'Die Zyklus-Risk-Metrik setzt den Kurs ins Verhältnis zu seinem mehrjährigen Durchschnitt und gewichtet ihn über die Zeit, damit die von Zyklus zu Zyklus schrumpfenden Ausschläge vergleichbar bleiben. Ergänzt wird sie um den MVRV-Z-Score, der aus On-Chain-Daten stammt statt aus dem Kursverlauf.',
      metrics: krypto,
    },
    {
      ...meta('metalle', gold ? `Gold-Heat ${wert(gold)}` : undefined),
      h1: 'Edelmetalle: Wie günstig stehen Gold, Silber und Palladium zu ihrem eigenen Trend?',
      lead: 'Für jedes Metall wird gemessen, wie weit der Kurs von seinem 200-Tage-Durchschnitt abweicht und an wie vielen Tagen der Historie diese Abweichung größer war.',
      metrics: metalle, extra: ratioText,
    },
    {
      ...meta('nasdaq-ki', b ? `KI-Blasen-Score ${fmt(b.score, 2)}` : undefined),
      h1: 'Nasdaq und KI: Wie weit ist die Bewertung von ihrem eigenen Trend entfernt?',
      lead: 'Der KI-Blasen-Score mittelt mehrere Perzentile zu einer Zahl zwischen 0 und 1. Er misst nicht, ob eine Blase platzt, sondern wie ungewöhnlich der heutige Zustand gegenüber der eigenen Vergangenheit ist.',
      metrics: ki, extra: bubbleText,
    },
    {
      ...meta('waehrungen'),
      h1: 'Währungen: Wie gedehnt sind Dollar, Euro, Franken, Yuan und Cedi?',
      lead: 'Alle Dollar-Paare notieren den US-Dollar als Basiswährung, eine steigende Kurve bedeutet dort also immer einen stärkeren Dollar. Einzige Ausnahme ist CHF/EUR, ein Kreuzpaar ohne Dollar. Währungen kennen keine Kaufzonen wie Aktien; bei ihnen sind die Extreme das Signal.',
      metrics: fx,
    },
    {
      ...meta('impressum'),
      h1: 'Impressum',
      lead: 'Anbieterkennzeichnung nach § 5 DDG. Dieses Dashboard ist ein privates, nicht-kommerzielles Statistikprojekt. Alle Kennzahlen sind rein historische Auswertungen und ausdrücklich keine Anlageberatung, keine Anlagevermittlung und keine Kauf- oder Verkaufsempfehlung.',
    },
    {
      ...meta('datenschutz'),
      h1: 'Datenschutzerklärung',
      lead: 'Diese Seite setzt keine Cookies, nutzt weder LocalStorage noch SessionStorage und enthält keine Formulare, keine Registrierung und kein Nutzerkonto. Verbindungen entstehen beim Aufruf zu Netlify (Hosting), GoatCounter (cookiefreie Reichweitenmessung) und GitHub (Abruf der Kennzahlen). Schriften werden vom eigenen Server ausgeliefert.',
    },
    {
      ...meta('generator'),
      h1: 'Sparplan- und Rebalancing-Generator',
      lead: 'Sparrate oder Depotwert eingeben; ein festes Regelwerk verschiebt die Gewichte entlang der aktuellen Signale. Die Berechnung läuft vollständig im Browser, eingegebene Beträge werden weder übertragen noch gespeichert. Simulation, keine Anlageberatung.',
    },
  ];
}

function jsonLd(p: Page, snap: Snapshot): string {
  const url = ORIGIN + (p.path ? '/' + p.path : '/');
  const graph: unknown[] = [{
    '@type': 'WebPage', '@id': url + '#page', url, name: p.title, description: p.desc,
    inLanguage: 'de-DE', dateModified: snap.generatedAt,
    isPartOf: { '@id': ORIGIN + '/#website' },
  }];
  if (p.metrics?.length) {
    graph.push({
      '@type': 'Dataset', '@id': url + '#daten', name: p.title, description: p.desc,
      inLanguage: 'de-DE', isAccessibleForFree: true, dateModified: snap.generatedAt,
      distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: ORIGIN + '/snapshot.json' },
      variableMeasured: p.metrics.map(m => ({
        '@type': 'PropertyValue', name: `${m.label} (${m.sym})`,
        description: `${m.kind === 'risk' ? 'Zyklus-Risk' : 'Heat-Perzentil'}, 0 bis 1`,
        // Maschinenlesbar bleibt die Zahl eine Zahl — das Komma gehört nur in die Anzeige.
        value: roundValue(m.kind, m.current.value), measurementTechnique: m.kind === 'risk'
          ? 'min-max-normiertes ln(Kurs/gleitender Durchschnitt) × Tagesindex^exp'
          : 'historisches Perzentil von ln(Kurs/SMA200)',
      })),
    });
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

function inhalt(p: Page, snap: Snapshot): string {
  const teile = [
    `<h1>${esc(p.h1)}</h1>`,
    `<p>${esc(p.lead)}</p>`,
    `<p>Stand der Daten: <time datetime="${snap.generatedAt}">${datum(snap.generatedAt)}</time>. Alle zwei Tage neu berechnet.</p>`,
  ];
  if (p.metrics?.length) { teile.push(tabelle(p.metrics)); teile.push(`<h2>Was die einzelnen Werte bedeuten</h2>`); teile.push(deutungen(p.metrics)); }
  if (p.extra) teile.push(p.extra);
  teile.push(METHODIK);
  teile.push(`<nav aria-label="Bereiche"><ul>
    <li><a href="/krypto">Krypto</a></li><li><a href="/metalle">Edelmetalle</a></li>
    <li><a href="/nasdaq-ki">Nasdaq und KI</a></li><li><a href="/waehrungen">Währungen</a></li>
    <li><a href="/generator">Generator</a></li><li><a href="/docs.html">Technisches Handbuch</a></li>
  </ul></nav>`);
  return teile.join('\n  ');
}

function schreibe(shell: string, p: Page, snap: Snapshot): void {
  const url = ORIGIN + (p.path ? '/' + p.path : '/');
  let html = shell.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
  // [Anfang des Tags bis zum Attributwert, neuer Wert] — ersetzt wird nur der Wert
  const tags: [string, string][] = [
    ['<meta name="description" content="', esc(p.desc)],
    ['<link rel="canonical" href="', url],
    ['<meta property="og:url" content="', url],
    ['<meta property="og:title" content="', esc(p.title)],
    ['<meta property="og:description" content="', esc(p.desc)],
    ['<meta name="twitter:title" content="', esc(p.title)],
    ['<meta name="twitter:description" content="', esc(p.desc)],
  ];
  for (const [start, neu] of tags) {
    const i = html.indexOf(start);
    if (i < 0) continue;
    const a = i + start.length;
    html = html.slice(0, a) + neu + html.slice(html.indexOf('"', a));
  }
  html = html.replace('</head>', `  ${jsonLd(p, snap)}\n</head>`);
  // Angular leert <app-root> beim Bootstrap; der Inhalt hier ist der Zustand davor.
  html = html.replace(/<app-root><\/app-root>/,
    `<app-root><div style="max-width:1100px;margin:0 auto;padding:28px 20px">\n  ${inhalt(p, snap)}\n</div></app-root>`);

  const dir = p.path ? join(DIST, p.path) : DIST;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

const snap = JSON.parse(readFileSync('public/snapshot.json', 'utf8')) as Snapshot;
const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!shell.includes('<app-root></app-root>')) {
  console.error('Statische Seiten: <app-root></app-root> nicht im Shell gefunden — Build-Format geändert?');
  process.exit(1);
}
const alle = seiten(snap);
for (const p of alle) schreibe(shell, p, snap);

/* Sitemap mit echtem lastmod. Aktualität ist ein messbarer Faktor dafür, ob KI-Suchen eine
   Quelle heranziehen — ohne Datum ist der Hinweis wertlos. Die Datenseiten tragen das Datum
   des Snapshots, die statischen Seiten bleiben ohne. */
const stand = snap.generatedAt.slice(0, 10);
const eintrag = (loc: string, freq: string, prio: string, mod?: string) =>
  `  <url>\n    <loc>${ORIGIN}${loc}</loc>${mod ? `\n    <lastmod>${mod}</lastmod>` : ''}` +
  `\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;
const urls = [
  eintrag('/', 'daily', '1.0', stand),
  ...alle.filter(p => p.path && p.metrics).map(p => eintrag('/' + p.path, 'daily', '0.9', stand)),
  eintrag('/generator', 'monthly', '0.7'),
  eintrag('/docs.html', 'monthly', '0.6'),
  eintrag('/llms.txt', 'monthly', '0.5'),
  eintrag('/impressum', 'yearly', '0.2'),
  eintrag('/datenschutz', 'yearly', '0.2'),
];
writeFileSync(join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

console.log(`Statische Seiten: ${alle.length} Routen geschrieben (${alle.map(p => '/' + p.path).join(' ')}), Sitemap mit lastmod ${stand}`);
