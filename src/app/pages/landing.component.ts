import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { einordnenAngezeigt, klartext, lageWort } from '../../../metrics-core/lage';
import { formatValue } from '../../../metrics-core/math';
import { PALETTE } from '../../../metrics-core/palette';
import { AssetClass, Lage } from '../../../metrics-core/types';
import { MarketDataService, MetricSnapshot } from '../core/market-data.service';
import { RevealDirective } from '../shared/reveal.directive';

/** Farbe trägt auf dieser Seite nur den Zustand — und nie allein: Jeder Zustand erscheint
 *  zusammen mit seinem Wort. Türkis/Rot heißt günstig/heiß; das gibt es nur bei Metriken
 *  mit Zonen. Bei Währungen gibt es kein günstig oder teuer, dort ist „ungewöhnlich" hell
 *  und ohne Wertung.
 *
 *  `ton` tönt die Kachel. Im Mittelfeld ist es die Flächenfarbe selbst, die Mischung ergibt
 *  also nichts — dass eine Kachel ungetönt bleibt, ist die Aussage. */
function farben(lage: Lage, wertend: boolean): { farbe: string; ton: string } {
  if (lage === 'neutral') return { farbe: PALETTE.muted, ton: PALETTE.panel };
  if (!wertend) return { farbe: PALETTE.fg, ton: PALETTE.muted };
  const f = lage === 'kauf' || lage === 'tief' ? PALETTE.lo : PALETTE.hi;
  return { farbe: f, ton: f };
}

/** Die vier Bereiche der Startseite, in Anzeigereihenfolge. Welche Assetklassen ein Bereich
 *  umfasst, steht nur hier — vorher an zwei Stellen, die gleich bleiben mussten. */
const BEREICHE: { route: string; titel: string; frage: string; klassen: AssetClass[] }[] = [
  { route: '/krypto', titel: 'Krypto', klassen: ['crypto'],
    frage: 'Wo stehen Bitcoin und Ethereum in ihrem Zyklus?' },
  { route: '/metalle', titel: 'Edelmetalle', klassen: ['metal'],
    frage: 'Wie günstig stehen Gold, Silber und Palladium zu ihrem Trend?' },
  { route: '/nasdaq-ki', titel: 'Nasdaq & KI', klassen: ['equity', 'credit'],
    frage: 'Wie weit ist die Bewertung vom eigenen Trend entfernt?' },
  { route: '/waehrungen', titel: 'Währungen', klassen: ['fx'],
    frage: 'Welche Währungsbewegungen sind gedehnt?' },
];

interface Zeile {
  id: string; klasse: AssetClass; name: string; wert: number; anzeige: string;
  lage: Lage; label: string; wertend: boolean; farbe: string; ton: string;
  /** Die Zahl als Satz — „Noch weiter unter dem Trend: nur an 11 % aller Tage." */
  klartext: string;
}
/** Eine Zeile im Lagebild: „Kaufzone: Gold und Silber". */
interface Gruppe { titel: string; namen: string; farbe: string; }

/** „Gold, Silber und Palladium" — ab fünf Namen „A, B, C und 2 weitere". */
function aufzaehlung(namen: string[], max = 4): string {
  const n = namen.length > max ? [...namen.slice(0, max - 1), `${namen.length - max + 1} weitere`] : namen;
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} und ${n[n.length - 1]}` : n[0];
}
interface Kachel {
  route: string; titel: string; frage: string;
  spitze: Zeile; zeilen: Zeile[]; auffaellige: number;
}

/** Die Einordnung kommt aus metrics-core/lage.ts — dieselbe Rechnung, nach der die Karte
 *  ihren Text und der Generator seine Begründung schreibt. */
function zeile(m: MetricSnapshot): Zeile {
  const e = einordnenAngezeigt(m.kind, m.current.value, m.zones, m.hotAbove);
  return {
    id: m.id, klasse: m.assetClass, wert: m.current.value,
    // Ohne Kurznamen der Teil vor „ · " — beim MVRV-Z-Score wäre das nur „Bitcoin".
    name: m.short ?? m.label.split(' · ')[0],
    anzeige: formatValue(m.kind, m.current.value),
    lage: e.lage, label: lageWort(e, m.sym), wertend: e.wertend, ...farben(e.lage, e.wertend),
    klartext: klartext(m),
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-landing',
  imports: [RouterLink, RevealDirective],
  template: `
    <!-- ============ Erster Viewport: nur die vier Kacheln ============ -->
    <p class="font-mono text-[11px] tracking-[2.5px] uppercase text-lo mb-4">
      Stand {{ stand() }} · alle zwei Tage neu berechnet
    </p>

    <!-- reveal-pending und in-view stehen hier fest im Markup: Was im ersten Viewport
         steht, darf nie vom IntersectionObserver abhängen. -->
    <section class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:min-h-[calc(100svh-250px)] sm:[&>*]:h-full reveal-pending in-view">
      @for (k of kacheln(); track k.route; let i = $index) {
        <a [routerLink]="k.route" [style.--ton]="k.spitze.ton" [style.animation-delay.ms]="i * 70"
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
                        text-[clamp(36px,5vw,52px)]" [style.color]="k.spitze.farbe">{{ k.spitze.anzeige }}</div>
            <!-- Zustand und Name in einer Zeile: Die Zahl steht für sich, der Rest ordnet sie ein. -->
            <div class="flex items-center gap-2 mt-2.5 min-w-0">
              <span class="inline-block w-2 h-2 rounded-full shrink-0" [style.background]="k.spitze.farbe"></span>
              <span class="font-mono text-[12px] shrink-0" [style.color]="k.spitze.farbe">{{ k.spitze.label }}</span>
              <span class="text-muted text-[12.5px] truncate">· {{ k.spitze.name }}</span>
            </div>
            <div class="skala mt-2" [style.--pos.%]="k.spitze.wert * 100">
              <div class="skala-band" [class.skala-neutral]="!k.spitze.wertend"></div>
              <div class="skala-marke"></div>
            </div>
            <!-- Die Zahl übersetzt: „0,11" sagt für sich nichts. -->
            <p class="text-[12.5px] text-muted leading-snug mt-2">{{ k.spitze.klartext }}</p>
          </div>

          <!-- Fuß -->
          <div class="flex items-center justify-between gap-3 font-mono text-[11.5px]">
            <span class="text-muted">{{ k.auffaellige === 0 ? 'nichts Auffälliges' : k.auffaellige + ' auffällig' }}</span>
            <span class="text-lo opacity-60 group-hover:opacity-100 transition-opacity">öffnen →</span>
          </div>
        </a>
      } @empty {
        <div class="sm:col-span-2 card border-dashed p-8 text-muted text-[13.5px]">
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
        <!-- Konkret statt „2 in der Kaufzone — die Kacheln oben zeigen, wo": Wer hier liest,
             soll nicht zurückscrollen müssen, um zu erfahren, welche. -->
        @if (lagebild(); as gruppen) {
          @if (gruppen.length) {
            <ul class="font-mono text-[13px] mt-5 space-y-1.5">
              @for (g of gruppen; track g.titel) {
                <li><span [style.color]="g.farbe">{{ g.titel }}:</span> <span class="text-fg">{{ g.namen }}</span></li>
              }
            </ul>
          } @else {
            <p class="font-mono text-[13px] text-muted mt-5">Keine Metrik in einer Kauf- oder Warnzone, alles im Mittelfeld. Ein ruhiger Tag.</p>
          }
        } @else {
          <p class="font-mono text-[13px] text-muted mt-5">Daten werden geladen …</p>
        }
      </div>
    </section>

    <section class="pt-10" appReveal>
      <h3 class="text-fg font-bold text-lg mb-4">Alle {{ alle().length }} Metriken</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (k of kacheln(); track k.route; let i = $index) {
          <div class="rise card p-6" [style.animation-delay.ms]="i * 60">
            <h4 class="text-fg font-bold text-[15px] mb-1">{{ k.titel }}</h4>
            <p class="text-muted text-[12.5px] leading-relaxed mb-5">{{ k.frage }}</p>
            @for (z of k.zeilen; track z.id) {
              <div class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-baseline mb-3.5">
                <span class="text-[13px] text-fg truncate">{{ z.name }}</span>
                <span class="font-mono text-[13px] tabular-nums" [style.color]="z.farbe">{{ z.anzeige }}</span>
                <div class="skala col-span-2" [style.--pos.%]="z.wert * 100">
                  <div class="skala-band" [class.skala-neutral]="!z.wertend"></div>
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
      <div class="rise card p-6">
        <h3 class="text-fg font-bold text-[17px] mb-1.5">Sparplan- und Rebalancing-Generator</h3>
        <p class="text-muted text-[12.5px] leading-relaxed mb-5">Sparrate oder Depotwert eingeben; ein festes
          Regelwerk verschiebt die Gewichte entlang der aktuellen Signale. Rechnet vollständig im Browser —
          eingegebene Beträge werden nicht übertragen.</p>
        <a routerLink="/generator" class="btn btn-ghost">Generator öffnen →</a>
      </div>
      <div class="rise card p-6" [style.animation-delay.ms]="60">
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

  protected readonly alle = computed<Zeile[]>(() => this.data.metrics().map(zeile));

  protected readonly kacheln = computed<Kachel[]>(() =>
    BEREICHE
      .map(b => ({ ...b, zeilen: this.alle().filter(z => b.klassen.includes(z.klasse)) }))
      .filter(k => k.zeilen.length)
      .map(k => ({
        route: k.route, titel: k.titel, frage: k.frage, zeilen: k.zeilen,
        // Der auffälligste Wert vertritt den Bereich — er bestimmt Zahl, Wort und Tönung.
        spitze: [...k.zeilen].sort((a, b) => Math.abs(b.wert - 0.5) - Math.abs(a.wert - 0.5))[0],
        auffaellige: k.zeilen.filter(z => z.lage !== 'neutral').length,
      })));

  protected readonly stand = computed(() => {
    const g = this.data.generatedAt();
    return g ? new Date(g).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
  });

  /** Die Gesamtlage beim Namen genannt, gruppiert wie die Kacheln einordnen. Währungen
   *  stehen für sich: Bei ihnen heißt „tief" nicht günstig. `null` solange Daten fehlen,
   *  eine leere Liste an einem ruhigen Tag. */
  protected readonly lagebild = computed<Gruppe[] | null>(() => {
    const zeilen = this.alle();
    if (!zeilen.length) return null;
    const gruppe = (titel: string, farbe: string, f: (z: Zeile) => boolean): Gruppe | null => {
      const namen = zeilen.filter(f).map(z => z.name);
      return namen.length ? { titel, farbe, namen: aufzaehlung(namen) } : null;
    };
    return [
      gruppe('Kaufzone', PALETTE.lo, z => z.lage === 'kauf'),
      gruppe('Warnzone', PALETTE.hi, z => z.lage === 'warn'),
      gruppe('Ungewöhnlich tief', PALETTE.lo, z => z.wertend && z.lage === 'tief'),
      gruppe('Ungewöhnlich hoch', PALETTE.hi, z => z.wertend && z.lage === 'hoch'),
      gruppe('Währungen weit vom Trend', PALETTE.fg, z => !z.wertend && z.lage !== 'neutral'),
    ].filter((g): g is Gruppe => g !== null);
  });
}
