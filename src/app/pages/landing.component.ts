import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketDataService, MetricSnapshot } from '../core/market-data.service';
import { RevealDirective } from '../shared/reveal.directive';

/** Zustand einer Metrik. Farbe trägt auf dieser Seite ausschließlich diese Bedeutung —
 *  und nie allein: Jeder Zustand erscheint zusammen mit seinem Wort. */
type Lage = 'kauf' | 'warn' | 'tief' | 'hoch' | 'neutral';

const LABEL: Record<Lage, string> = {
  kauf: 'Kaufzone', warn: 'Warnzone', tief: 'ungewöhnlich tief',
  hoch: 'ungewöhnlich hoch', neutral: 'im Mittelfeld',
};
/** Ab diesem Abstand von der Mitte gilt ein Wert als auffällig. */
const RAND = 0.25;
const PANEL = '#101A2C';

interface Zeile {
  id: string; name: string; kurz: string; wert: number; anzeige: string;
  lage: Lage; label: string; route: string; deutung: string;
}
interface Kachel {
  route: string; titel: string; frage: string;
  spitze: Zeile; zeilen: Zeile[]; auffaellige: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-landing',
  imports: [RouterLink, RevealDirective],
  template: `
    <!-- ============ Erster Viewport: nur die vier Kacheln ============ -->
    <p class="font-mono text-[11px] tracking-[2.5px] uppercase text-lo mb-4">
      Stand {{ stand() }} · täglich neu berechnet
    </p>

    <section class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:min-h-[calc(100svh-250px)] sm:[&>*]:h-full reveal-pending in-view">
      @for (k of kacheln(); track k.route; let i = $index) {
        <a [routerLink]="k.route" [style.--ton]="ton(k.spitze.lage)" [style.animation-delay.ms]="i * 70"
           class="kachel rise group flex flex-col justify-between gap-3 p-4 md:p-5 rounded-2xl
                  border border-line no-underline min-h-[196px] transition-colors hover:border-lo/50">
          <!-- Kopf -->
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-fg font-bold text-[18px] md:text-[20px]">{{ k.titel }}</h2>
            <span class="font-mono text-[11px] text-muted">{{ k.zeilen.length }} Metriken</span>
          </div>

          <!-- Kernaussage: der auffälligste Wert des Bereichs -->
          <div>
            <div class="font-mono font-semibold leading-none tabular-nums
                        text-[clamp(36px,5vw,52px)]" [style.color]="farbe(k.spitze.lage)">{{ k.spitze.anzeige }}</div>
            <!-- Zustand und Name in einer Zeile: Die Zahl steht für sich, der Rest ordnet sie ein. -->
            <div class="flex items-center gap-2 mt-2.5 min-w-0">
              <span class="inline-block w-2 h-2 rounded-full shrink-0" [style.background]="farbe(k.spitze.lage)"></span>
              <span class="font-mono text-[12px] shrink-0" [style.color]="farbe(k.spitze.lage)">{{ k.spitze.label }}</span>
              <span class="text-muted text-[12.5px] truncate">· {{ k.spitze.name }}</span>
            </div>
            <div class="skala mt-2" [style.--pos.%]="k.spitze.wert * 100">
              <div class="skala-band"></div>
              <div class="skala-marke"></div>
            </div>
          </div>

          <!-- Fuß -->
          <div class="flex items-center justify-between gap-3 font-mono text-[11.5px]">
            <span class="text-muted">{{ k.auffaellige === 0 ? 'nichts Auffälliges' :
              k.auffaellige === 1 ? '1 auffällig' : k.auffaellige + ' auffällig' }}</span>
            <span class="text-lo opacity-60 group-hover:opacity-100 transition-opacity">öffnen →</span>
          </div>
        </a>
      } @empty {
        <div class="sm:col-span-2 bg-panel border border-dashed border-line rounded-2xl p-8 text-muted text-[13.5px]">
          Die Kennzahlen werden geladen …
        </div>
      }
    </section>

    <!-- ============ Ab hier: Erklärung und Details ============ -->
    <section class="pt-16 md:pt-24" appReveal>
      <div class="rise max-w-2xl">
        <h2 class="text-2xl md:text-3xl font-bold leading-tight">Was ist heute außergewöhnlich?</h2>
        <p class="text-muted mt-4 text-[15px] leading-relaxed">
          Jedes Asset wird nur an seiner eigenen Geschichte gemessen: Wie weit liegt der Kurs von seinem
          langfristigen Trend entfernt, und wie oft kam das vorher vor? Ein Wert nahe 0 heißt historisch
          günstig, nahe 1 historisch teuer — <b class="text-fg">und die Mitte heißt: nichts Besonderes.</b>
          Jede Kachel oben zeigt den auffälligsten Wert ihres Bereichs.
        </p>
        <p class="font-mono text-[13px] text-muted mt-5">{{ lagebild() }}</p>
      </div>
    </section>

    <section class="pt-10" appReveal>
      <h3 class="text-fg font-bold text-lg mb-4">Alle {{ alle().length }} Metriken</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (k of kacheln(); track k.route; let i = $index) {
          <div class="rise bg-panel border border-line rounded-2xl p-6" [style.animation-delay.ms]="i * 60">
            <h4 class="text-fg font-bold text-[15px] mb-1">{{ k.titel }}</h4>
            <p class="text-muted text-[12.5px] leading-relaxed mb-5">{{ k.frage }}</p>
            @for (z of k.zeilen; track z.id) {
              <div class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-baseline mb-3.5">
                <span class="text-[13px] text-fg truncate">{{ z.name }}</span>
                <span class="font-mono text-[13px] tabular-nums" [style.color]="farbe(z.lage)">{{ z.anzeige }}</span>
                <div class="skala col-span-2" [style.--pos.%]="z.wert * 100">
                  <div class="skala-band"></div>
                  <div class="skala-marke"></div>
                </div>
              </div>
            }
            <a [routerLink]="k.route" class="btn btn-ghost btn-sm mt-2">{{ k.titel }} öffnen →</a>
          </div>
        }
      </div>
    </section>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-10" appReveal>
      <div class="rise bg-panel border border-line rounded-2xl p-6">
        <h3 class="text-fg font-bold text-[17px] mb-1.5">Sparplan- und Rebalancing-Generator</h3>
        <p class="text-muted text-[12.5px] leading-relaxed mb-5">Sparrate oder Depotwert eingeben; ein festes
          Regelwerk verschiebt die Gewichte entlang der aktuellen Signale. Rechnet vollständig im Browser —
          eingegebene Beträge werden nicht übertragen.</p>
        <a routerLink="/generator" class="btn btn-ghost">Generator öffnen →</a>
      </div>
      <div class="rise bg-panel border border-line rounded-2xl p-6" [style.animation-delay.ms]="60">
        <h3 class="text-fg font-bold text-[17px] mb-1.5">Methodik im Detail</h3>
        <p class="text-muted text-[12.5px] leading-relaxed mb-5">Das technische Handbuch zeigt die Formeln zum
          Durchrechnen, den Weg der Daten von der Quelle bis zur Karte — und die Grenzen des Verfahrens.</p>
        <a href="/docs.html" target="_blank" rel="noopener" class="btn btn-ghost">Handbuch öffnen ↗</a>
      </div>
    </div>
  `,
})
export class LandingComponent {
  private data = inject(MarketDataService);

  protected readonly alle = computed<Zeile[]>(() => this.data.metrics().map(m => this.zeile(m)));

  protected readonly kacheln = computed<Kachel[]>(() => {
    const von = (f: (m: MetricSnapshot) => boolean) => this.data.metrics().filter(f).map(m => this.zeile(m));
    const roh = [
      { route: '/krypto', titel: 'Krypto', frage: 'Wo stehen Bitcoin und Ethereum in ihrem Zyklus?',
        zeilen: von(m => m.assetClass === 'crypto') },
      { route: '/metalle', titel: 'Edelmetalle', frage: 'Wie günstig stehen Gold, Silber und Palladium zu ihrem Trend?',
        zeilen: von(m => m.assetClass === 'metal') },
      { route: '/nasdaq-ki', titel: 'Nasdaq & KI', frage: 'Wie weit ist die Bewertung vom eigenen Trend entfernt?',
        zeilen: von(m => m.assetClass === 'equity' || m.assetClass === 'credit') },
      { route: '/waehrungen', titel: 'Währungen', frage: 'Welche Währungsbewegungen sind gedehnt?',
        zeilen: von(m => m.assetClass === 'fx') },
    ];
    return roh.filter(k => k.zeilen.length).map(k => ({
      ...k,
      // Der auffälligste Wert vertritt den Bereich — er bestimmt Zahl, Wort und Tönung.
      spitze: [...k.zeilen].sort((a, b) => Math.abs(b.wert - 0.5) - Math.abs(a.wert - 0.5))[0],
      auffaellige: k.zeilen.filter(z => z.lage !== 'neutral').length,
    }));
  });

  protected readonly stand = computed(() => {
    const g = this.data.generatedAt();
    return g ? new Date(g).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
  });

  /** Ein ehrlicher Satz zur Gesamtlage — auch dann, wenn gerade nichts los ist. */
  protected readonly lagebild = computed<string>(() => {
    const zeilen = this.alle();
    if (!zeilen.length) return 'Daten werden geladen …';
    const zonen = zeilen.filter(z => z.lage === 'kauf' || z.lage === 'warn');
    const rand = zeilen.filter(z => z.lage !== 'neutral').length;
    if (zonen.length) {
      const k = zonen.filter(z => z.lage === 'kauf').length;
      const w = zonen.length - k;
      return [k ? `${k} in der Kaufzone` : '', w ? `${w} in der Warnzone` : '']
        .filter(Boolean).join(', ') + ' — die Kacheln oben zeigen, wo.';
    }
    return rand
      ? `Keine Metrik in einer Kauf- oder Warnzone. ${rand} ${rand === 1 ? 'liegt' : 'liegen'} am Rand des gewohnten Bereichs.`
      : 'Keine Metrik in einer Kauf- oder Warnzone, alles im Mittelfeld. Ein ruhiger Tag.';
  });

  protected farbe(l: Lage): string {
    return l === 'kauf' || l === 'tief' ? '#22C6B8' : l === 'warn' || l === 'hoch' ? '#F0533F' : '#8A97AC';
  }

  /** Tönung der Kachel. „Neutral" bekommt die Flächenfarbe selbst, mischt sich also zu
   *  nichts — dass eine Kachel ungetönt bleibt, ist die Aussage. */
  protected ton(l: Lage): string {
    return l === 'kauf' || l === 'tief' ? '#22C6B8' : l === 'warn' || l === 'hoch' ? '#F0533F' : PANEL;
  }

  private zeile(m: MetricSnapshot): Zeile {
    const v = m.current.value;
    const kauf = m.zones.length ? Math.max(...m.zones.map(z => z.below)) : null;
    const warn = m.hotAbove;
    // Zonen der Metrik gehen vor; darunter entscheidet der Abstand zur Mitte.
    let lage: Lage = 'neutral';
    if (kauf !== null && v < kauf) lage = 'kauf';
    else if (warn !== null && v > warn) lage = 'warn';
    else if (v < 0.5 - RAND) lage = 'tief';
    else if (v > 0.5 + RAND) lage = 'hoch';
    const route = m.assetClass === 'crypto' ? '/krypto' : m.assetClass === 'metal' ? '/metalle'
      : m.assetClass === 'fx' ? '/waehrungen' : '/nasdaq-ki';
    return {
      id: m.id, name: m.label.split(' · ')[0], kurz: m.sym, wert: v,
      anzeige: v.toFixed(m.kind === 'risk' ? 3 : 2),
      lage, label: LABEL[lage], route,
      deutung: m.interpret.replace(/<[^>]+>/g, ''),
    };
  }
}
