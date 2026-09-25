/** Tests der gemeinsamen Einordnung — und vor allem, dass alle, die sie anzeigen, dasselbe
 *  sagen. Anlass: Ethereum bei 0,504 hieß auf der Karte „heißgelaufen", auf der Startseite
 *  „im Mittelfeld" und im Generator „neutral". Der Registry-Test unten hätte das gefunden. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signalTiltStrategy, ASSET_UNIVERSE, PROFILES } from './allocation';
import { einordnen, einordnenAngezeigt, klartext, lageWort } from './lage';
import { defaultSignal } from './math';
import { REGISTRY } from './metrics';
import { MetricResult, MetricSnapshot, Zone } from './types';

const ETH: Zone[] = [
  { label: 'Kleine Tranchen', text: '< 0.30', below: 0.30 },
  { label: 'Rate erhöhen', text: '< 0.10', below: 0.10 },
  { label: 'Kapitulation', text: '< 0.05', below: 0.05 },
];
const KAUFZONE: Zone[] = [{ label: 'Kaufzone', text: '< 0.15', below: 0.15 }];

test('einordnen: Zonen der Metrik gehen vor, Grenzen wie bei den Chips', () => {
  assert.equal(einordnen(0.504, ETH, 0.70).lage, 'neutral');
  assert.equal(einordnen(0.30, ETH, 0.70).lage, 'neutral');          // Chip: aktiv erst bei < 0.30
  assert.equal(einordnen(0.70, ETH, 0.70).lage, 'neutral');          // Warnung erst bei > 0.70
  assert.equal(einordnen(0.71, ETH, 0.70).lage, 'warn');
  assert.deepEqual(einordnen(0.29, ETH, 0.70).zone?.label, 'Kleine Tranchen');
  assert.deepEqual(einordnen(0.04, ETH, 0.70).zone?.label, 'Kapitulation');   // tiefste Stufe
});

test('einordnen: außerhalb der Zonen zählt der Abstand zur Mitte', () => {
  assert.equal(einordnen(0.18, KAUFZONE, 0.85).lage, 'tief');
  assert.equal(einordnen(0.80, KAUFZONE, 0.85).lage, 'hoch');
  assert.equal(einordnen(0.10, KAUFZONE, 0.85).lage, 'kauf');
  assert.equal(einordnen(0.90, KAUFZONE, 0.85).lage, 'warn');
  assert.equal(einordnen(0.60, KAUFZONE, 0.85).wertend, true);
});

test('einordnenAngezeigt: eingeordnet wird die Zahl, die man liest', () => {
  // Gold 0,149 wird als 0.15 angezeigt — dann darf daneben nicht „Kaufzone < 0.15" stehen.
  assert.equal(einordnenAngezeigt('heat', 0.149, KAUFZONE, 0.85).lage, 'tief');
  assert.equal(einordnenAngezeigt('heat', 0.144, KAUFZONE, 0.85).lage, 'kauf');
  // Risk zeigt drei Stellen, dort liegt die Grenze entsprechend feiner.
  assert.equal(einordnenAngezeigt('risk', 0.2996, ETH, 0.70).lage, 'neutral');   // „0.300"
  assert.equal(einordnenAngezeigt('risk', 0.2994, ETH, 0.70).lage, 'kauf');      // „0.299"
});

test('lageWort: Währungen sind schwach oder stark, nicht günstig oder teuer', () => {
  const tief = einordnen(0.06, [], null);
  assert.equal(tief.wertend, false);
  assert.equal(lageWort(tief, 'CHF/EUR'), 'Franken ungewöhnlich schwach');
  assert.equal(lageWort(tief, 'USD/EUR'), 'Dollar ungewöhnlich schwach');
  assert.equal(lageWort(einordnen(0.91, [], null), 'USD/CHF'), 'Dollar ungewöhnlich stark');
  assert.equal(lageWort(einordnen(0.9, [], null), 'DXY'), 'Dollar ungewöhnlich stark');
  assert.equal(lageWort(einordnen(0.5, [], null), 'DXY'), 'im Mittelfeld');
  assert.equal(lageWort(einordnen(0.1, KAUFZONE, 0.85), 'XAU/USD'), 'Kaufzone');
});

/* ===== Kein Kartentext darf der Einordnung widersprechen ===== */
const KAUF_WORT = /Kaufzone|Bodenniveau|historisch günstig|historisch niedrig|Stress im Kreditmarkt/;
const WARN_WORT = /Warnzone|heißgelaufen|Extrembereich|maximale Sorglosigkeit/;
/** Behauptet „ungewöhnlich" als Lage. Nicht jedes „ungewöhnlich" tut das: „Der Franken
 *  schwächelt — ungewöhnlich, er ist die klassische Fluchtwährung" meint die Richtung. */
const RAND_WORT = /ungewöhnlich (tief|hoch|weit|niedrig|sorglos|vorsichtig)/;
/** „noch nicht die Kaufzone" und Ähnliches nennt die Zone, behauptet sie aber nicht. */
const VERNEINT = /(noch nicht (die|in der)|oberhalb der|unterhalb der) (Kauf|Warn)zone/g;

function ergebnis(v: number): MetricResult {
  return {
    dates: ['2000-01-03'], prices: [1], values: [v],
    current: { date: '2026-01-02', price: 1.02, sma: 1, value: v, staleDays: 0 },
    priceForValue: () => 1,
  };
}

test('jede Registry-Metrik: Kartentext passt über das ganze Spektrum zur Einordnung', () => {
  const werte = Array.from({ length: 99 }, (_, i) => (i + 1) / 100);
  for (const def of REGISTRY) {
    for (const v of werte) {
      const e = einordnen(v, def.zones, def.hotAbove);
      const text = def.interpret(ergebnis(v), e).replace(/<[^>]+>/g, '').replace(VERNEINT, '');
      const ort = `${def.id} bei ${v} (${e.lage}): ${text}`;
      const kauf = KAUF_WORT.test(text), warn = WARN_WORT.test(text);
      if (e.lage === 'kauf') assert.ok(kauf && !warn, ort);
      else if (e.lage === 'warn') assert.ok(warn && !kauf, ort);
      else if (e.lage === 'neutral') assert.ok(!kauf && !warn && !RAND_WORT.test(text), ort);
      else assert.ok(!kauf && !warn && RAND_WORT.test(text), ort);
    }
  }
});

test('Generator: Begründung nennt dieselbe Lage wie Karte und Startseite', () => {
  const wert: Record<string, number> = { 'eth-risk': 0.504, 'ndx-heat': 0.717, 'gold-heat': 0.112 };
  const metrics = REGISTRY.map(def => {
    const v = wert[def.id] ?? 0.5;
    return { id: def.id, kind: def.kind, zones: def.zones, hotAbove: def.hotAbove,
      current: { value: v }, signal: defaultSignal(v) } as unknown as MetricSnapshot;
  });
  const rows = signalTiltStrategy.allocate({
    profile: PROFILES[1], maxCryptoWeight: 0.25, metrics,
    activeAssetIds: ASSET_UNIVERSE.map(a => a.id),
  });
  const note = (id: string) => rows.find(r => r.asset.id === id)!.note;
  assert.match(note('eth'), /im Mittelfeld/);
  // Nasdaq liegt im Mittelfeld, das stufenlose Regelwerk nimmt trotzdem Gewicht weg —
  // beides steht getrennt da, statt „historisch heiße Zone" zu behaupten.
  assert.match(note('ndx'), /im Mittelfeld\. Anteil sinkt/);
  assert.match(note('gold'), /in der Kaufzone\. Anteil steigt/);
});

test('klartext: die Zahl in einem Satz', () => {
  const m = (kind: 'heat' | 'risk', value: number, extra?: MetricSnapshot['extra']) =>
    ({ kind, current: { value }, extra }) as unknown as MetricSnapshot;
  assert.equal(klartext(m('heat', 0.112)), 'Noch weiter unter dem Trend: nur an 11 % aller Tage.');
  assert.equal(klartext(m('heat', 0.92)), 'Noch weiter über dem Trend: nur an 8 % aller Tage.');
  assert.equal(klartext(m('heat', 0.64)), 'Noch weiter über dem Trend: an 36 % aller Tage.');
  assert.equal(klartext(m('heat', 0.003)), 'Noch weiter unter dem Trend: an weniger als 1 % aller Tage.');
  assert.equal(klartext(m('heat', 0.41, { priceLabel: 'Z-Score' })), 'Z-Score noch niedriger: an 41 % aller Tage.');
  assert.equal(klartext(m('risk', 0.447)), 'Bei 45 % des Wegs von früheren Zyklustiefs zu früheren Zyklushochs.');
});
