import { Service, computed, resource } from '@angular/core';
import {
  BearSnapshot, BubbleSnapshot, MetricSnapshot, RatioSnapshot, Snapshot,
} from '../../../metrics-core/types';
import { fmt } from '../../../metrics-core/math';

export { fmt };
export type { BearSnapshot, BubbleSnapshot, MetricSnapshot, RatioSnapshot, Snapshot };

/** Primärquelle: Raw-URL des Repos. Der tägliche Lauf committet dorthin, also sind die
 *  Daten auch dann aktuell, wenn ein Netlify-Build scheitert oder hängt. Die Kopie aus
 *  dem Build-Paket bleibt Fallback — fällt GitHub aus, zeigt die Seite weiter Zahlen. */
const SNAPSHOT_REMOTE = 'https://raw.githubusercontent.com/Jonesxxl/market-dashboard/main/public/snapshot.json';

@Service()
export class MarketDataService {
  readonly market = resource<Snapshot, void>({ loader: () => this.fetchSnapshot() });

  readonly loading = computed(() => this.market.isLoading());
  readonly error = computed(() => this.market.error() ? 'Snapshot konnte nicht geladen werden.' : null);
  readonly failed = computed(() => this.market.value()?.failed ?? []);
  readonly generatedAt = computed(() => this.market.value()?.generatedAt ?? null);
  /** Zeigt das Demo-JSON aus dem Build-Paket an? Dann lief der tägliche Cron noch nie. */
  readonly isBootstrap = computed(() => this.market.value()?.bootstrap === true);
  /** Alter des Snapshots in Tagen — für die Staleness-Warnung im Header. */
  readonly ageDays = computed(() => {
    const g = this.generatedAt();
    return g ? Math.floor((Date.now() - new Date(g).getTime()) / 864e5) : 0;
  });

  readonly metrics = computed<MetricSnapshot[]>(() => this.market.value()?.metrics ?? []);
  readonly ratios = computed<RatioSnapshot[]>(() => this.market.value()?.derived.ratios ?? []);
  readonly bear = computed<BearSnapshot | null>(() => this.market.value()?.derived.bear ?? null);
  readonly bubble = computed<BubbleSnapshot | null>(() => this.market.value()?.derived.bubble ?? null);

  byId(id: string): MetricSnapshot | undefined {
    return this.metrics().find(m => m.id === id);
  }
  byIds(ids: string[]): MetricSnapshot[] {
    return ids.map(id => this.byId(id)).filter((m): m is MetricSnapshot => !!m);
  }

  reload(): void { this.market.reload(); }

  private async fetchSnapshot(): Promise<Snapshot> {
    const urls = SNAPSHOT_REMOTE ? [SNAPSHOT_REMOTE, '/snapshot.json'] : ['/snapshot.json'];
    let lastErr: unknown = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' (' + url + ')');
        const snap = (await res.json()) as Snapshot;
        if (snap.version !== 1 || !Array.isArray(snap.metrics)) throw new Error('Ungültiges Snapshot-Schema');
        return snap;
      } catch (e) { lastErr = e; console.warn('Snapshot-Quelle fehlgeschlagen:', url, e); }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Snapshot nicht ladbar');
  }
}
