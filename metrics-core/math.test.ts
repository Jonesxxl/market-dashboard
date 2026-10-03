/** Tests für den Rechenkern. Laufen mit `npm run test:core` (Node-Test-Runner über tsx,
 *  keine zusätzlichen Abhängigkeiten). Bewusst ohne Netz und ohne Abhängigkeit vom
 *  heutigen Datum — sie dürfen an keinem Tag anders ausgehen als an einem anderen. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeHeat, computeRisk, defaultSignal, equalWeightIndex, formatValue, kindLabel,
  percentileRank, ratioSeries, staleDays,
} from './math';
import { Row } from './types';

/** `n` Tage ab `start`, Kurs aus `f(i)`. */
function reihe(n: number, f: (i: number) => number, start = '2020-01-01'): Row[] {
  const t0 = Date.parse(start);
  return Array.from({ length: n }, (_, i) => [new Date(t0 + i * 864e5).toISOString().slice(0, 10), f(i)] as Row);
}
/** Ein Kursverlauf mit Trend und Schwingung — genug Bewegung für sinnvolle Perzentile. */
const welle = (i: number) => 100 * Math.exp(0.0008 * i + 0.25 * Math.sin(i / 45));

test('percentileRank: Anteil der Werte ≤ v', () => {
  const s = [1, 2, 2, 3];
  assert.equal(percentileRank(s, 0), 0);
  assert.equal(percentileRank(s, 2), 0.75);
  assert.equal(percentileRank(s, 2.5), 0.75);
  assert.equal(percentileRank(s, 3), 1);
});

test('equalWeightIndex: nur gemeinsame Tage, erster gemeinsamer Tag = 1, Mittel der Mitglieder', () => {
  const a: Row[] = [['2024-01-03', 30], ['2024-01-01', 10], ['2024-01-02', 20]];   // unsortiert
  const b: Row[] = [['2024-01-02', 5], ['2024-01-03', 10], ['2024-01-04', 20]];
  // Gemeinsam: 02. und 03. — A: 20 → 30 (×1,5), B: 5 → 10 (×2), Mittel 1,75
  assert.deepEqual(equalWeightIndex([a, b]), [['2024-01-02', 1], ['2024-01-03', 1.75]]);
  assert.deepEqual(equalWeightIndex([]), []);
});

test('computeHeat: Skalierung ändert den Heat-Wert nicht (Grundlage der 100-$-Körbe)', () => {
  const p = reihe(600, welle);
  const k = reihe(600, i => 37 * welle(i));
  assert.deepEqual(computeHeat(k).values, computeHeat(p).values);
});

test('computeHeat: Reihe beginnt nach dem Vorlauf des gleitenden Durchschnitts', () => {
  const r = computeHeat(reihe(600, welle), 200);
  assert.equal(r.values.length, 600 - 199);
  assert.equal(r.dates[0], reihe(600, welle)[199][0]);
  for (const v of r.values) assert.ok(v !== null && v > 0 && v <= 1);
});

test('computeRisk: priceForValue kehrt die Formel am letzten Tag exakt um', () => {
  // Die Tabelle „Welcher Kurs entspricht welchem Risk?" hängt daran.
  const r = computeRisk(reihe(900, i => 30000 * welle(i) / 100, '2022-01-01'), 'btc');
  assert.ok(r.current.value > 0 && r.current.value < 1, 'Wert liegt nicht am Rand der Normierung');
  const zurueck = r.priceForValue!(r.current.value);
  assert.ok(Math.abs(zurueck / r.current.price - 1) < 1e-9, `${zurueck} ≠ ${r.current.price}`);
});

test('computeRisk: unbekanntes Asset wird abgelehnt statt still falsch gerechnet', () => {
  assert.throws(() => computeRisk(reihe(400, welle), 'doge'), /Keine eingefrorenen Konstanten/);
});

test('staleDays: ganze Tage, nie negativ', () => {
  const jetzt = Date.parse('2026-01-11T12:00:00Z');
  assert.equal(staleDays('2026-01-01', jetzt), 11);   // 10,5 Tage, gerundet
  assert.equal(staleDays('2026-02-01', jetzt), 0);
});

test('defaultSignal: 0 → +1, 0,5 → 0, 1 → −1', () => {
  assert.equal(defaultSignal(0), 1);
  assert.equal(defaultSignal(0.5), 0);
  assert.equal(defaultSignal(1), -1);
});

test('formatValue und kindLabel: Risk drei Stellen, Heat zwei', () => {
  assert.equal(formatValue('risk', 0.4), '0.400');
  assert.equal(formatValue('heat', 0.4), '0.40');
  assert.equal(kindLabel('risk'), 'Risk');
  assert.equal(kindLabel('heat'), 'Heat');
});

test('ratioSeries: zu wenig Überlappung ist ein Fehler, kein kurzer Verlauf', () => {
  assert.throws(() => ratioSeries(reihe(100, welle), reihe(100, welle)), /zu wenig/);
  assert.equal(ratioSeries(reihe(400, welle), reihe(400, () => 2)).length, 400);
});
