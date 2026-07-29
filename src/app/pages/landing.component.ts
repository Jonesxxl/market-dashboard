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
      <p class="font-mono text-[11.5px] tracking-[2.5px] uppercase text-lo mb-3.5">Marktlage auf einen Blick · täglich frisch</p>
      <h2 class="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
        Ein Maß für alle Märkte:<br><span class="text-lo">Wie extrem ist heute — gemessen an der eigenen Geschichte?</span>
      </h2>
      <p class="text-muted max-w-2xl mt-4 text-[15px]">
        Dieses Dashboard beantwortet für Krypto, Edelmetalle, den Nasdaq und die großen Währungen dieselbe Frage:
        Wie weit liegt der Kurs über oder unter seinem langfristigen Trend — und wie selten war das bisher?
        Daraus entstehen vergleichbare Kauf- und Warnzonen statt Bauchgefühl.
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

    <div class="mt-4 bg-panel border border-line rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h3 class="text-fg font-bold text-lg mb-1">⚖ Sparplan- &amp; Rebalancing-Generator</h3>
        <p class="text-muted text-[13px]">Sparrate oder Depot eingeben — ein festes Regelwerk neigt die Gewichte
          entlang der aktuellen Signale. Läuft komplett im Browser, deine Zahlen verlassen das Gerät nie.</p>
      </div>
      <a routerLink="/generator"
         class="bg-panel2 border border-line text-fg font-mono text-[12.5px] px-5 py-2.5 rounded-[9px] no-underline hover:border-lo">Ausprobieren →</a>
    </div>

    <div class="mt-4 bg-panel border border-line rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h3 class="text-fg font-bold text-lg mb-1">Wie funktioniert das alles?</h3>
        <p class="text-muted text-[13px]">Interaktives Handbuch: Formel-Spielwiese, Architektur, Signalzonen zum Ausprobieren — und die ehrlichen Grenzen der Methodik.</p>
      </div>
      <a href="/docs.html" target="_blank" rel="noopener"
         class="bg-panel2 border border-line text-fg font-mono text-[12.5px] px-5 py-2.5 rounded-[9px] no-underline hover:border-lo">Doku öffnen ↗</a>
    </div>
  `,
})
export class LandingComponent {
  private data = inject(MarketDataService);

  protected readonly teasers = computed<Teaser[]>(() => {
    const btc = this.data.byId('btc-risk');
    const gold = this.data.byId('gold-heat');
    const bubble = this.data.bubble();
    const eur = this.data.byId('eurusd');
    const risk = btc ? btc.current.value : null;
    return [
      {
        route: '/krypto', title: 'Krypto',
        desc: 'Zyklus-Risk-Metrik für Bitcoin und Ethereum, Preisniveaus je Risk-Zone und der direkte Bärenmarkt-Vergleich 2017/18 vs. 2025/26.',
        metric: 'BTC Risk', value: risk != null ? risk.toFixed(2) : null,
        color: risk != null ? (risk < 0.2 ? '#22C6B8' : risk < 0.5 ? '#F2B33D' : '#F0533F') : '#8A97AC',
      },
      {
        route: '/metalle', title: 'Metalle',
        desc: 'Gold, Silber und Palladium mit Heat-Perzentilen plus Gold/Silber- und Palladium/Gold-Ratio als Kontraindikatoren.',
        metric: 'Gold Heat', value: gold ? gold.current.value.toFixed(2) : null,
        color: '#E3C05A',
      },
      {
        route: '/nasdaq-ki', title: 'Nasdaq & KI',
        desc: 'KI-Blasen-Score aus bis zu fünf Bausteinen: Trends, Marktdominanz, Konzentration und Kredit-Risikoappetit.',
        metric: 'Blasen-Score', value: bubble ? bubble.score.toFixed(2) : null,
        color: bubble ? (bubble.score > 0.85 ? '#F0533F' : bubble.score > 0.6 ? '#F2B33D' : '#22C6B8') : '#8A97AC',
      },
      {
        route: '/waehrungen', title: 'Währungen',
        desc: 'Dollar-Index, EUR/USD, USD/CHF, USD/CNY und USD/GHS — gedehnte Bewegungen als Makro-Frühindikatoren.',
        metric: 'EUR/USD Heat', value: eur ? eur.current.value.toFixed(2) : null,
        color: '#F2B33D',
      },
    ];
  });

  protected readonly fmt = fmt;
}
