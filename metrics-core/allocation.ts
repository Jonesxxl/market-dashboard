/** metrics-core · Allokations-Engine für den Investment-/Rebalancing-Generator.
 *  Deterministisch, regelbasiert, komplett client-seitig lauffähig.
 *  Erweiterbar an drei Stellen: ASSET_UNIVERSE (neue Assets), PROFILES (neue Profile),
 *  AllocationStrategy (neue Strategien). */
import { MetricSnapshot } from './types';

/* ===== Investierbares Universum: Asset ↔ Metrik ===== */
export type AssetClassKey = 'crypto' | 'metal' | 'equity' | 'cash';

export interface AssetDef {
  id: string; label: string; hex: string;
  cls: AssetClassKey;
  /** Registry-Metrik, deren signal (−1…+1) das Tilt liefert. null = Cash. */
  metricId: string | null;
  /** Gewicht innerhalb der Assetklasse (wird über aktive Assets renormalisiert). */
  intraClass: number;
}

export const ASSET_UNIVERSE: AssetDef[] = [
  { id: 'btc', label: 'Bitcoin', hex: '#E8963C', cls: 'crypto', metricId: 'btc-risk', intraClass: 0.70 },
  { id: 'eth', label: 'Ethereum', hex: '#8A7BF0', cls: 'crypto', metricId: 'eth-risk', intraClass: 0.30 },
  { id: 'gold', label: 'Gold', hex: '#E3C05A', cls: 'metal', metricId: 'gold-heat', intraClass: 0.60 },
  { id: 'silver', label: 'Silber', hex: '#B8C4D4', cls: 'metal', metricId: 'silver-heat', intraClass: 0.25 },
  { id: 'pall', label: 'Palladium', hex: '#7FD0C9', cls: 'metal', metricId: 'pall-heat', intraClass: 0.15 },
  { id: 'ndx', label: 'Nasdaq 100 (ETF)', hex: '#5FA8F5', cls: 'equity', metricId: 'ndx-heat', intraClass: 0.70 },
  { id: 'ai', label: 'KI-Aktien-Korb', hex: '#F06FA8', cls: 'equity', metricId: 'ai-basket-heat', intraClass: 0.30 },
  { id: 'cash', label: 'Cash-Puffer', hex: '#8A97AC', cls: 'cash', metricId: null, intraClass: 1 },
];

/* ===== Risikoprofile ===== */
export interface Profile {
  id: string; label: string;
  /** Basisgewichte je Assetklasse (Summe 1). */
  classWeights: Record<AssetClassKey, number>;
  /** Wie stark Signale die Basisgewichte kippen dürfen (0…1). */
  tiltStrength: number;
}

export const PROFILES: Profile[] = [
  { id: 'defensiv', label: 'Defensiv', tiltStrength: 0.3,
    classWeights: { crypto: 0.10, metal: 0.35, equity: 0.35, cash: 0.20 } },
  { id: 'ausgewogen', label: 'Ausgewogen', tiltStrength: 0.5,
    classWeights: { crypto: 0.20, metal: 0.30, equity: 0.40, cash: 0.10 } },
  { id: 'offensiv', label: 'Offensiv', tiltStrength: 0.7,
    classWeights: { crypto: 0.35, metal: 0.20, equity: 0.40, cash: 0.05 } },
];

/* ===== Ergebnis-Typen ===== */
export interface AllocationRow {
  asset: AssetDef;
  baseWeight: number;      // vor Tilt
  targetWeight: number;    // nach Tilt + Constraints (0…1, Summe 1)
  signal: number;          // −1…+1 aus der Metrik (0 wenn keine Daten)
  metricValue: number | null;
  metricKind: 'risk' | 'heat' | null;
  hasData: boolean;
  note: string;            // Ein-Satz-Begründung
}

export interface RebalanceTrade {
  asset: AssetDef; action: 'kaufen' | 'verkaufen';
  amount: number; fromWeight: number; toWeight: number;
}

export interface AllocationInput {
  profile: Profile;
  activeAssetIds: string[];       // abgewählte Assets fallen raus, Klasse renormalisiert
  maxCryptoWeight: number;        // 0…1, harte Obergrenze; Überschuss wandert in Cash
  metrics: MetricSnapshot[];      // aus dem Snapshot
}

export interface AllocationStrategy {
  id: string; label: string;
  allocate(input: AllocationInput): AllocationRow[];
}

/* ===== v1-Strategie: Basisgewichte × Signal-Tilt ===== */
export const signalTiltStrategy: AllocationStrategy = {
  id: 'signal-tilt-v1',
  label: 'Basisgewichte mit Signal-Neigung',
  allocate({ profile, activeAssetIds, maxCryptoWeight, metrics }): AllocationRow[] {
    const byId = new Map(metrics.map(m => [m.id, m]));
    const active = ASSET_UNIVERSE.filter(a => a.cls === 'cash' || activeAssetIds.includes(a.id));

    // 1) Basisgewicht = Klassengewicht × (intraClass renormalisiert über aktive Klassen-Assets)
    const rows: AllocationRow[] = active.map(asset => {
      const clsAssets = active.filter(a => a.cls === asset.cls);
      const intraSum = clsAssets.reduce((s, a) => s + a.intraClass, 0);
      const base = profile.classWeights[asset.cls] * (asset.intraClass / intraSum);
      const m = asset.metricId ? byId.get(asset.metricId) : undefined;
      return {
        asset, baseWeight: base, targetWeight: base,
        signal: m?.signal ?? 0,
        metricValue: m?.current.value ?? null,
        metricKind: m?.kind ?? null,
        hasData: asset.metricId === null || !!m,
        note: '',
      };
    });
    // Klassen ohne aktives Asset: ihr Gewicht fließt in Cash
    const covered = new Set(rows.map(r => r.asset.cls));
    const orphan = (Object.keys(profile.classWeights) as AssetClassKey[])
      .filter(c => !covered.has(c)).reduce((s, c) => s + profile.classWeights[c], 0);
    const cashRow = rows.find(r => r.asset.cls === 'cash')!;
    cashRow.baseWeight += orphan; cashRow.targetWeight += orphan;

    // 2) Tilt: Gewicht × (1 + Stärke × Signal); Cash bekommt das Gegen-Signal des Rests
    const risky = rows.filter(r => r.asset.cls !== 'cash');
    const avgSignal = risky.reduce((s, r) => s + r.signal * r.baseWeight, 0) /
      Math.max(1e-9, risky.reduce((s, r) => s + r.baseWeight, 0));
    for (const r of rows) {
      const sig = r.asset.cls === 'cash' ? -avgSignal : r.signal;
      r.targetWeight = r.targetWeight * (1 + profile.tiltStrength * sig);
    }

    // 3) Normalisieren, dann Krypto-Deckel (Überschuss → Cash), dann erneut runden
    const norm = () => {
      const sum = rows.reduce((s, r) => s + r.targetWeight, 0);
      rows.forEach(r => { r.targetWeight = r.targetWeight / sum; });
    };
    norm();
    const cryptoSum = rows.filter(r => r.asset.cls === 'crypto').reduce((s, r) => s + r.targetWeight, 0);
    if (cryptoSum > maxCryptoWeight && cryptoSum > 0) {
      const factor = maxCryptoWeight / cryptoSum;
      let freed = 0;
      rows.filter(r => r.asset.cls === 'crypto').forEach(r => {
        freed += r.targetWeight * (1 - factor);
        r.targetWeight *= factor;
      });
      cashRow.targetWeight += freed;
    }
    norm();

    // 4) Begründungen
    for (const r of rows) {
      if (r.asset.cls === 'cash') {
        r.note = avgSignal < -0.05
          ? 'Die Signale stehen im Schnitt auf Reduzieren — der Puffer wächst und wartet auf bessere Niveaus.'
          : avgSignal > 0.05
            ? 'Die Signale stehen im Schnitt auf Akkumulieren — der Puffer gibt Kapital an die Zielgewichte ab.'
            : 'Neutrale Signallage — der Puffer bleibt nahe seiner Basisgröße.';
      } else if (!r.hasData) {
        r.note = 'Keine aktuellen Metrik-Daten — bleibt auf Basisgewicht (kein Tilt).';
      } else {
        const v = r.metricValue!.toFixed(2);
        const name = r.metricKind === 'risk' ? 'Risk' : 'Heat';
        r.note = r.signal > 0.3 ? `${name} ${v} — historisch günstige Zone, wird übergewichtet.`
          : r.signal < -0.3 ? `${name} ${v} — historisch heiße Zone, wird untergewichtet.`
          : `${name} ${v} — neutraler Bereich, nahe Basisgewicht.`;
      }
      r.targetWeight = +r.targetWeight.toFixed(4);
      r.baseWeight = +r.baseWeight.toFixed(4);
    }
    return rows;
  },
};

export const STRATEGIES: AllocationStrategy[] = [signalTiltStrategy];

/* ===== Anwendungen: DCA-Plan und Rebalancing ===== */
export function dcaPlan(rows: AllocationRow[], monthly: number):
  { asset: AssetDef; amount: number; weight: number; note: string }[] {
  return rows
    .map(r => ({ asset: r.asset, amount: Math.round(monthly * r.targetWeight), weight: r.targetWeight, note: r.note }))
    .filter(x => x.amount >= 1)
    .sort((a, b) => b.amount - a.amount);
}

/** Rebalancing: Ist-Positionen (€) → Handelsliste. Nur Abweichungen über dem Schwellenband. */
export function rebalance(rows: AllocationRow[], positions: Record<string, number>,
  bandPts = 0.02): { trades: RebalanceTrade[]; total: number; current: Map<string, number> } {
  const total = rows.reduce((s, r) => s + (positions[r.asset.id] ?? 0), 0);
  const current = new Map(rows.map(r => [r.asset.id, total > 0 ? (positions[r.asset.id] ?? 0) / total : 0]));
  if (total <= 0) return { trades: [], total: 0, current };
  const trades: RebalanceTrade[] = [];
  for (const r of rows) {
    const cur = current.get(r.asset.id)!;
    const diff = r.targetWeight - cur;
    if (Math.abs(diff) < bandPts) continue;   // innerhalb des Bandes: Handelskosten sparen
    trades.push({
      asset: r.asset,
      action: diff > 0 ? 'kaufen' : 'verkaufen',
      amount: Math.round(Math.abs(diff) * total),
      fromWeight: +cur.toFixed(4), toWeight: r.targetWeight,
    });
  }
  // Verkäufe zuerst (liefern die Liquidität für die Käufe)
  trades.sort((a, b) => (a.action === b.action ? b.amount - a.amount : a.action === 'verkaufen' ? -1 : 1));
  return { trades, total, current };
}
