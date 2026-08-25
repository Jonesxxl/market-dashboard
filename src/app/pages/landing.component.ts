import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketDataService, MetricSnapshot } from '../core/market-data.service';
import { RevealDirective } from '../shared/reveal.directive';

/** Zustand einer Metrik. Farbe trägt auf dieser Seite ausschließlich diese Bedeutung —
 *  und nie allein: Jeder Zustand erscheint zusammen mit seinem Wort. */
type Lage = 'kauf' | 'warn' | 'tief' | 'hoch' | 'neutral';

interface Zeile {
  id: string; name: string; kurz: string; wert: number; anzeige: string;
  lage: Lage; label: string; route: string; deutung: string;
}
interface Gruppe { route: string; titel: string; frage: string; zeilen: Zeile[] }

const LABEL: Record<Lage, string> = {
  kauf: 'Kaufzone', warn: 'Warnzone', tief: 'ungewöhnlich tief',
  hoch: 'ungewöhnlich hoch', neutral: 'im Mittelfeld',
};

/** Ab diesem Abstand von der Mitte gilt ein Wert als auffällig — dieselbe Schwelle, die
 *  auch die Zählung im Kopf verwendet, damit Überschrift und Etiketten dasselbe sagen. */
const RAND = 0.25;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-landing',
  imports: [RouterLink, RevealDirective],
  template: `
    <!-- ===== Aufmacher ===== -->
    <section class="pt-6 pb-10 md:pt-10 md:pb-14">
      <p class="font-mono text-[11px] tracking-[2.5px] uppercase text-lo mb-4">
        Marktlage auf einen Blick · Stand {{ stand() }}
      </p>
      <h2 class="text-3xl md:text-[44px] font-bold leading-[1.1] max-w-3xl">
        Was ist heute außergewöhnlich?
      </h2>
      <p class="text-muted max-w-2xl mt-5 text-[15px] leading-relaxed">
        Jedes Asset wird nur an seiner eigenen Geschichte gemessen: Wie weit liegt der Kurs von seinem
        langfristigen Trend entfernt, und wie oft kam das vorher vor? Ein Wert nahe 0 heißt historisch
        günstig, nahe 1 historisch teuer — <b class="text-fg">und die Mitte heißt: nichts Besonderes.</b>
      </p>
      <p class="font-mono text-[13px] text-muted mt-6">{{ lagebild() }}</p>
    </section>

    <!-- ===== Was gerade heraussticht =====
         Beide Klassen fest im Markup statt über den Beobachter: Diese Sektion steht über
         der Falz und ist beim Laden ohnehin zu sehen. Hinge sie am IntersectionObserver,
         wäre bei dessen Ausfall die halbe Startseite leer — bei einem Chart ist ein
         Ausfall verschmerzbar, hier nicht. Die Animation läuft damit sofort los. -->
    <section class="mb-12 reveal-pending in-view">
      <div class="flex items-baseline justify-between gap-4 flex-wrap mb-4">
        <h3 class="text-fg font-bold text-lg">Am weitesten vom Normalen entfernt</h3>
        <span class="font-mono text-[11.5px] text-faint">{{ auffaellig().length }} von {{ alle().length }} Metriken
          außerhalb des Mittelfelds</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (z of spitzen(); track z.id; let i = $index) {
          <a [routerLink]="z.route" class="rise block bg-panel border border-line rounded-2xl p-5 no-underline
                    hover:border-lo/40 transition-colors group" [style.animation-delay.ms]="i * 60">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="min-w-0">
                <div class="text-fg font-bold text-[14px] leading-tight truncate">{{ z.name }}</div>
                <div class="font-mono text-[11px] text-faint mt-0.5">{{ z.kurz }}</div>
              </div>
              <div class="font-mono text-[30px] font-semibold leading-none shrink-0"
                   [style.color]="farbe(z.lage)">{{ z.anzeige }}</div>
            </div>

            <div class="flex items-center gap-2 mb-3">
              <span class="inline-block w-2 h-2 rounded-full shrink-0" [style.background]="farbe(z.lage)"></span>
              <span class="font-mono text-[11.5px]" [style.color]="farbe(z.lage)">{{ z.label }}</span>
            </div>

            <div class="skala" [style.--pos.%]="z.wert * 100">
              <div class="skala-band"></div>
              <div class="skala-marke"></div>
            </div>

            <p class="text-[12.5px] text-muted leading-relaxed mt-3 line-clamp-3">{{ z.deutung }}</p>
            <div class="font-mono text-[11.5px] text-lo mt-3 opacity-70 group-hover:opacity-100">ansehen →</div>
          </a>
        } @empty {
          <div class="bg-panel border border-dashed border-line rounded-2xl p-6 text-muted text-[13.5px]">
            Sobald der tägliche Lauf Werte geliefert hat, stehen hier die auffälligsten Metriken.
          </div>
        }
      </div>
    </section>

    <!-- ===== Alle Bereiche ===== -->
    <section class="mb-10" appReveal>
      <h3 class="text-fg font-bold text-lg mb-4">Alle Bereiche</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (g of gruppen(); track g.route; let i = $index) {
          <a [routerLink]="g.route" class="rise block bg-panel border border-line rounded-2xl p-6 no-underline
                    hover:border-lo/40 transition-colors group" [style.animation-delay.ms]="i * 60">
            <div class="flex items-baseline justify-between gap-3 mb-1">
              <h4 class="text-fg font-bold text-[17px]">{{ g.titel }}</h4>
              <span class="font-mono text-[11px] text-lo opacity-0 group-hover:opacity-100 transition-opacity">öffnen →</span>
            </div>
            <p class="text-muted text-[12.5px] leading-relaxed mb-5">{{ g.frage }}</p>

            @for (z of g.zeilen; track z.id) {
              <div class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-baseline mb-3.5">
                <span class="text-[13px] text-fg truncate">{{ z.name }}</span>
                <span class="font-mono text-[13px] tabular-nums" [style.color]="farbe(z.lage)">{{ z.anzeige }}</span>
                <div class="skala col-span-2" [style.--pos.%]="z.wert * 100">
                  <div class="skala-band"></div>
                  <div class="skala-marke"></div>
                </div>
              </div>
            }
          </a>
        }
      </div>
    </section>

    <!-- ===== Werkzeuge ===== -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4" appReveal>
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

  /** „Auffällig" heißt hier: außerhalb des Mittelfelds von 0,25 bis 0,75. Das ist die
   *  Aussage der Seite selbst — extrem gegenüber der eigenen Geschichte. */
  protected readonly auffaellig = computed(() => this.alle().filter(z => z.lage !== 'neutral'));

  /** Die drei größten Abstände von der Mitte. Bewusst immer gefüllt: Auch ein ruhiger Tag
   *  hat ein Extrem, es heißt dann eben „unauffällig" — statt eine leere Sektion zu zeigen. */
  protected readonly spitzen = computed(() =>
    [...this.alle()].sort((a, b) => Math.abs(b.wert - 0.5) - Math.abs(a.wert - 0.5)).slice(0, 3));

  protected readonly stand = computed(() => {
    const g = this.data.generatedAt();
    return g ? new Date(g).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
  });

  /** Ein ehrlicher Satz zur Gesamtlage — auch dann, wenn gerade nichts los ist. */
  protected readonly lagebild = computed<string>(() => {
    const zonen = this.alle().filter(z => z.lage === 'kauf' || z.lage === 'warn');
    const rand = this.auffaellig().length;
    if (!this.alle().length) return 'Daten werden geladen …';
    if (zonen.length) {
      const k = zonen.filter(z => z.lage === 'kauf').length;
      const w = zonen.length - k;
      const teile = [k ? `${k} in der Kaufzone` : '', w ? `${w} in der Warnzone` : ''].filter(Boolean);
      return `${teile.join(', ')} — die auffälligsten stehen unten.`;
    }
    return rand
      ? `Keine Metrik in einer Kauf- oder Warnzone. ${rand} ${rand === 1 ? 'liegt' : 'liegen'} am Rand des gewohnten Bereichs.`
      : 'Keine Metrik in einer Kauf- oder Warnzone, alles im Mittelfeld. Ein ruhiger Tag.';
  });

  protected readonly gruppen = computed<Gruppe[]>(() => {
    const von = (f: (m: MetricSnapshot) => boolean) => this.data.metrics().filter(f).map(m => this.zeile(m));
    return [
      { route: '/krypto', titel: 'Krypto', frage: 'Wo stehen Bitcoin und Ethereum in ihrem Zyklus?',
        zeilen: von(m => m.assetClass === 'crypto') },
      { route: '/metalle', titel: 'Edelmetalle', frage: 'Wie günstig stehen Gold, Silber und Palladium zu ihrem Trend?',
        zeilen: von(m => m.assetClass === 'metal') },
      { route: '/nasdaq-ki', titel: 'Nasdaq & KI', frage: 'Wie weit ist die Bewertung vom eigenen Trend entfernt?',
        zeilen: von(m => m.assetClass === 'equity' || m.assetClass === 'credit') },
      { route: '/waehrungen', titel: 'Währungen', frage: 'Welche Währungsbewegungen sind gedehnt?',
        zeilen: von(m => m.assetClass === 'fx') },
    ].filter(g => g.zeilen.length);
  });

  protected farbe(l: Lage): string {
    return l === 'kauf' || l === 'tief' ? '#22C6B8' : l === 'warn' || l === 'hoch' ? '#F0533F' : '#8A97AC';
  }

  private zeile(m: MetricSnapshot): Zeile {
    const v = m.current.value;
    const kauf = m.zones.length ? Math.max(...m.zones.map(z => z.below)) : null;
    const warn = m.hotAbove;
    // Zonen der Metrik gehen vor; darunter entscheidet der Abstand zur Mitte. Ohne die
    // zweite Stufe stünde eine Karte unter „am weitesten vom Normalen entfernt" und
    // trüge zugleich das Etikett „im Mittelfeld" — für den Leser ein Widerspruch.
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
