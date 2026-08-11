import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketDataService, fmt } from '../core/market-data.service';

interface Teaser {
  route: string; title: string; desc: string; metric: string;
  value: string | null; color: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-landing',
  imports: [RouterLink],
  template: `
    <section class="py-10 md:py-16 border-b border-line mb-8">
      <p class="font-mono text-[11.5px] tracking-[2.5px] uppercase text-lo mb-3.5">Marktlage auf einen Blick · täglich neu berechnet</p>
      <h2 class="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
        Ein Maßstab für alle Märkte:<br><span class="text-lo">Wie außergewöhnlich ist der heutige Kurs?</span>
      </h2>
      <p class="text-muted max-w-2xl mt-5 text-[15px] leading-relaxed">
        Für Krypto, Edelmetalle, den Nasdaq und die großen Währungen wird dieselbe Frage beantwortet: Wie weit
        liegt der Kurs über oder unter seinem langfristigen Trend — und an wie vielen Tagen der Vergangenheit
        war diese Abweichung noch größer? Weil jedes Asset nur an seiner eigenen Historie gemessen wird, sind
        die Ergebnisse untereinander vergleichbar.
      </p>
    </section>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      @for (t of teasers(); track t.route) {
        <a [routerLink]="t.route"
           class="block bg-panel border border-line rounded-2xl p-6 no-underline hover:border-muted transition-colors group"
           [attr.aria-label]="t.title + ' öffnen'">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-fg font-bold text-lg mb-1.5">{{ t.title }}</h3>
              <p class="text-muted text-[13px] leading-relaxed">{{ t.desc }}</p>
            </div>
            <div class="text-right shrink-0">
              <div class="font-mono text-3xl font-semibold" [style.color]="t.color">
                {{ t.value ?? '…' }}
              </div>
              <div class="font-mono text-[10.5px] text-faint uppercase tracking-wide mt-1">{{ t.metric }}</div>
            </div>
          </div>
          <div class="font-mono text-[12px] text-lo mt-4 opacity-70 group-hover:opacity-100">ansehen →</div>
        </a>
      }
    </div>

    <div class="mt-4 bg-panel border border-line rounded-2xl p-6 flex items-center justify-between gap-5 flex-wrap">
      <div class="max-w-2xl">
        <h3 class="text-fg font-bold text-lg mb-1.5">Sparplan- und Rebalancing-Generator</h3>
        <p class="text-muted text-[13px] leading-relaxed">Sparrate oder Depotwert eingeben; ein festes Regelwerk
          verschiebt die Gewichte entlang der aktuellen Signale. Die Berechnung läuft vollständig im Browser —
          eingegebene Beträge werden nicht übertragen und nicht gespeichert.</p>
      </div>
      <a routerLink="/generator" class="btn btn-ghost">Generator öffnen →</a>
    </div>

    <div class="mt-4 bg-panel border border-line rounded-2xl p-6 flex items-center justify-between gap-5 flex-wrap">
      <div class="max-w-2xl">
        <h3 class="text-fg font-bold text-lg mb-1.5">Methodik im Detail</h3>
        <p class="text-muted text-[13px] leading-relaxed">Das technische Handbuch zeigt die Formeln zum
          Durchrechnen, den Weg der Daten von der Quelle bis zur Karte, die Signalzonen zum Ausprobieren — und
          die Grenzen des Verfahrens.</p>
      </div>
      <a href="/docs.html" target="_blank" rel="noopener" class="btn btn-ghost">Handbuch öffnen ↗</a>
    </div>
  `,
})
export class LandingComponent {
  private data = inject(MarketDataService);

  protected readonly teasers = computed<Teaser[]>(() => {
    const btc = this.data.byId('btc-risk');
    const gold = this.data.byId('gold-heat');
    const bubble = this.data.bubble();
    const eur = this.data.byId('usdeur');
    const risk = btc ? btc.current.value : null;
    return [
      {
        route: '/krypto', title: 'Krypto',
        desc: 'Zyklus-Risk für Bitcoin und Ethereum, die zugehörigen Kursniveaus je Zone und der direkte Vergleich der Bärenmärkte 2017/18 und 2025/26.',
        metric: 'BTC Risk', value: risk != null ? risk.toFixed(2) : null,
        color: risk != null ? (risk < 0.2 ? '#22C6B8' : risk < 0.5 ? '#F2B33D' : '#F0533F') : '#8A97AC',
      },
      {
        route: '/metalle', title: 'Edelmetalle',
        desc: 'Gold, Silber und Palladium als Heat-Perzentile, ergänzt um das Gold/Silber- und das Palladium/Gold-Verhältnis.',
        metric: 'Gold Heat', value: gold ? gold.current.value.toFixed(2) : null,
        color: '#E3C05A',
      },
      {
        route: '/nasdaq-ki', title: 'Nasdaq & KI',
        desc: 'Der KI-Blasen-Score bündelt fünf Messgrößen: zwei Trends, den Vorsprung der KI-Werte, die Marktkonzentration und den Kredit-Risikoappetit.',
        metric: 'Blasen-Score', value: bubble ? bubble.score.toFixed(2) : null,
        color: bubble ? (bubble.score > 0.85 ? '#F0533F' : bubble.score > 0.6 ? '#F2B33D' : '#22C6B8') : '#8A97AC',
      },
      {
        route: '/waehrungen', title: 'Währungen',
        desc: 'Dollar-Index sowie USD/EUR, USD/CHF, USD/CNY und USD/GHS — durchgehend aus Dollar-Sicht, weit gedehnte Bewegungen als Makro-Frühindikator.',
        metric: 'USD/EUR Heat', value: eur ? eur.current.value.toFixed(2) : null,
        color: '#F2B33D',
      },
    ];
  });

  protected readonly fmt = fmt;
}
