/** metrics-core · Einordnung eines 0…1-Werts. Die einzige Stelle, die entscheidet, ob ein Wert
 *  in der Kaufzone, in der Warnzone, ungewöhnlich oder im Mittelfeld liegt.
 *
 *  Gelesen vom Snapshot-Lauf (Deutungstexte der Karten), von der Startseite (Wort und Farbe
 *  der Kacheln) und vom Generator (Begründung je Asset). Vorher hatte jede dieser Stellen
 *  eigene Schwellen; Ethereum bei 0,504 hieß gleichzeitig „heißgelaufen", „im Mittelfeld"
 *  und „neutral".
 *
 *  Die Zonen selbst kommen aus der Metrik (`zones`, `hotAbove` in der Registry) — dieselben
 *  Werte, nach denen die Chips unter dem Farbband aufleuchten. Auch die Vergleiche sind
 *  dieselben: Kaufzone heißt `value < below`, Warnzone `value > hotAbove`. */
import { formatValue } from './math';
import { Einordnung, Lage, MetricKind, Zone } from './types';

/** Ab diesem Abstand von der Mitte gilt ein Wert außerhalb der Zonen als ungewöhnlich. */
export const RAND = 0.25;

/** Reine Schwellenlogik. Aufrufer mit einer Metrik nehmen `einordnenAngezeigt` — nur die
 *  rundet so, wie die Seite den Wert zeigt. */
export function einordnen(value: number, zones: Zone[], hotAbove: number | null): Einordnung {
  const wertend = zones.length > 0 || hotAbove !== null;
  // Tiefste Zone zuerst: Bei Risk ist das die Stufe, in der der Wert tatsächlich liegt.
  const unter = zones.filter(z => value < z.below).sort((a, b) => a.below - b.below);
  if (unter.length) return { lage: 'kauf', zone: unter[0], wertend };
  if (hotAbove !== null && value > hotAbove) return { lage: 'warn', zone: null, wertend };
  if (value < 0.5 - RAND) return { lage: 'tief', zone: null, wertend };
  if (value > 0.5 + RAND) return { lage: 'hoch', zone: null, wertend };
  return { lage: 'neutral', zone: null, wertend };
}

/** Einordnung des Werts, **wie er angezeigt wird** — Risk mit drei, Heat mit zwei Stellen.
 *  Das ist die Variante für alle Aufrufer. Ungerundet eingeordnet stand bei Gold „0.15 ·
 *  Kaufzone" neben dem Chip „Kaufzone < 0.15": Der Wert war 0,149, angezeigt als 0,15.
 *  Wer liest, rechnet mit der Zahl, die er sieht. */
export function einordnenAngezeigt(kind: MetricKind, value: number, zones: Zone[], hotAbove: number | null): Einordnung {
  return einordnen(+formatValue(kind, value), zones, hotAbove);
}

export const LAGE_WORT: Record<Lage, string> = {
  kauf: 'Kaufzone', warn: 'Warnzone', tief: 'ungewöhnlich tief',
  hoch: 'ungewöhnlich hoch', neutral: 'im Mittelfeld',
};

const WAEHRUNG: Record<string, string> = { USD: 'Dollar', DXY: 'Dollar', CHF: 'Franken', EUR: 'Euro' };

/** Das Wort zur Lage, wie es neben der Zahl steht. Bei Metriken ohne Zonen (Währungen) heißt
 *  „tief" nicht günstig, sondern: die Basiswährung ist schwächer als ihr Trend. */
export function lageWort(e: Einordnung, sym: string): string {
  if (e.wertend || (e.lage !== 'tief' && e.lage !== 'hoch')) return LAGE_WORT[e.lage];
  const basis = sym.split('/')[0];
  return `${WAEHRUNG[basis] ?? basis} ungewöhnlich ${e.lage === 'tief' ? 'schwach' : 'stark'}`;
}
