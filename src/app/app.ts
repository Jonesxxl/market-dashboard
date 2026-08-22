import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Routes, RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MarketDataService, fmt } from './core/market-data.service';

declare global {
  interface Window { goatcounter?: { count: (opts: { path: string }) => void }; }
}

/* ===== Routen ===== */
/* `title` und `data.description` werden von der AppTitleStrategy (src/app/core/title-strategy.ts)
   zu Titel, Meta-Beschreibung, OG-Tags und Canonical verarbeitet — ohne das teilen sich alle
   Routen denselben Eintrag in Tab, Suchergebnis und Link-Vorschau. */
export const routes: Routes = [
  {
    path: '', title: '',
    loadComponent: () => import('./pages/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'krypto', title: 'Krypto — Risk-Metrik für Bitcoin und Ethereum',
    data: { description: 'Zyklus-Risk für Bitcoin und Ethereum: 0 entspricht dem Niveau historischer Böden, 1 dem historischer Tops. Dazu Kursniveaus je Risk-Zone, der Digital-Asset-Basket und der Vergleich der Bärenmärkte 2017/18 und 2025/26.' },
    loadComponent: () => import('./pages/crypto.component').then(m => m.CryptoComponent),
  },
  {
    path: 'metalle', title: 'Edelmetalle — Gold, Silber und Palladium',
    data: { description: 'Heat-Perzentile für Gold, Silber und Palladium: wie weit der Kurs von seinem 200-Tage-Durchschnitt abweicht und wie selten das historisch war. Dazu Gold/Silber- und Palladium/Gold-Verhältnis.' },
    loadComponent: () => import('./pages/metals.component').then(m => m.MetalsComponent),
  },
  {
    path: 'nasdaq-ki', title: 'Nasdaq und KI — Blasen-Score',
    data: { description: 'Der KI-Blasen-Score bündelt fünf Messgrößen: Nasdaq-Trend, Trend des KI-Baskets, dessen Vorsprung vor dem S&P 500, die Marktkonzentration (SPY/RSP) und den Kredit-Risikoappetit (HYG/LQD).' },
    loadComponent: () => import('./pages/ai.component').then(m => m.AiComponent),
  },
  {
    path: 'waehrungen', title: 'Währungen — Dollar-Index und Paare',
    data: { description: 'Dollar-Index, USD/EUR, USD/CHF, USD/CNY, USD/GHS und das Kreuzpaar CHF/EUR — je Karte der Heat-Wert und der tatsächliche Kursverlauf. Bei den Dollar-Paaren bedeutet eine steigende Kurve immer einen stärkeren Dollar.' },
    loadComponent: () => import('./pages/fx.component').then(m => m.FxComponent),
  },
  {
    path: 'generator', title: 'Sparplan- und Rebalancing-Generator',
    data: { description: 'Leitet aus den aktuellen Signalen eine Gewichtung für Sparrate oder Depot ab. Die Berechnung läuft vollständig im Browser — eingegebene Beträge werden nicht übertragen und nicht gespeichert.' },
    loadComponent: () => import('./pages/generator.component').then(m => m.GeneratorComponent),
  },
  {
    path: 'impressum', title: 'Impressum',
    data: { description: 'Anbieterkennzeichnung nach § 5 DDG sowie Hinweise zu Haftung und Inhalt des Macro Risk Dashboards.' },
    loadComponent: () => import('./pages/impressum.component').then(m => m.ImpressumComponent),
  },
  {
    path: 'datenschutz', title: 'Datenschutz',
    data: { description: 'Diese Seite setzt keine Cookies, nutzt keinen LocalStorage und enthält keine Formulare. Welche Daten beim Aufruf trotzdem verarbeitet werden, steht hier.' },
    loadComponent: () => import('./pages/datenschutz.component').then(m => m.DatenschutzComponent),
  },
  { path: '**', redirectTo: '' },
];

/* ===== Shell ===== */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="max-w-[1100px] mx-auto px-5 pb-16 pt-7">
      <header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-6">
        <a routerLink="/" class="no-underline max-w-2xl rounded-[10px]">
          <h1 class="text-[22px] font-bold text-fg">Macro Risk Dashboard</h1>
          <p class="text-xs text-muted mt-1.5 leading-relaxed">Bewertet Krypto, Edelmetalle, den Nasdaq und die
            großen Währungen danach, wie weit sie von ihrem eigenen Langfristtrend abweichen — und wie selten
            eine solche Abweichung historisch war.</p>
        </a>
        <!-- Eigener Block statt schrumpfendem Flex-Item: links auf Mobil, rechts ab sm.
             Vorher richtete text-right den Knopf nur an der Breite des Zeitstempels aus. -->
        <div class="flex flex-col items-start gap-2.5 shrink-0 sm:items-end">
          <span class="font-mono text-xs text-muted">{{ stamp() }}</span>
          <button type="button" class="btn btn-ghost" (click)="reload()" [disabled]="data.loading()">
            @if (data.loading()) {
              <span class="inline-block w-3 h-3 rounded-full border-2 border-muted border-t-transparent animate-spin"
                    aria-hidden="true"></span>
              Aktualisiert …
            } @else {
              Neu laden
            }
          </button>
        </div>
      </header>

      @if (data.isBootstrap()) {
        <div class="font-mono text-[13px] px-4 py-3.5 border border-dashed border-mid rounded-xl mb-5 text-mid"
             role="status">
          <b>Beispieldaten aus dem Build-Paket</b> (Stand {{ bootstrapDate() }}) — der tägliche Berechnungslauf
          hat bislang kein Ergebnis geschrieben. Die gezeigten Werte sind daher nicht aktuell und dienen nur der
          Darstellung. Mit dem ersten erfolgreichen Lauf werden sie durch echte Tageskurse ersetzt.
        </div>
      } @else if (statusText(); as st) {
        <div class="font-mono text-[13px] px-4 py-3.5 border border-dashed rounded-xl mb-5"
             [class.text-muted]="!isError()" [class.border-line]="!isError()"
             [class.text-red-300]="isError()" [class.border-red-900]="isError()"
             role="status" aria-live="polite">{{ st }}</div>
      }

      <nav class="flex gap-2 mb-6 flex-wrap items-center" aria-label="Hauptnavigation">
        <a routerLink="/" routerLinkActive="btn-on" [routerLinkActiveOptions]="{ exact: true }"
           class="btn btn-ghost">Start</a>
        <a routerLink="/krypto" routerLinkActive="btn-on" class="btn btn-ghost">Krypto</a>
        <a routerLink="/metalle" routerLinkActive="btn-on" class="btn btn-ghost">Metalle</a>
        <a routerLink="/nasdaq-ki" routerLinkActive="btn-on" class="btn btn-ghost">Nasdaq &amp; KI</a>
        <a routerLink="/waehrungen" routerLinkActive="btn-on" class="btn btn-ghost">Währungen</a>
        <a routerLink="/generator" routerLinkActive="btn-on" class="btn btn-ghost">Generator</a>
        <a href="/docs.html" target="_blank" rel="noopener" class="btn btn-ghost ml-auto">Handbuch ↗</a>
      </nav>

      <main><router-outlet/></main>

      <footer class="text-xs text-muted leading-relaxed mt-10 border-t border-line pt-6">
        <div class="grid gap-6 md:grid-cols-2 max-w-4xl">
          <div>
            <h2 class="text-fg font-bold text-[13px] mb-1.5">Das Prinzip</h2>
            <p>Kein Asset wird mit einem anderen verglichen, sondern ausschließlich mit seiner eigenen
            Vergangenheit. Gemessen wird der Abstand des Kurses zu seinem langfristigen Durchschnitt — und
            anschließend, an wie vielen Handelstagen der Historie dieser Abstand größer war. Das Ergebnis ist
            eine Zahl zwischen 0 und 1, die sich über alle Anlageklassen hinweg gleich liest.</p>
          </div>
          <div>
            <h2 class="text-fg font-bold text-[13px] mb-1.5">Die beiden Kennzahlen</h2>
            <p><b class="text-fg">Heat</b> (Metalle, Aktien, Währungen) ist ein Perzentil zum
            200-Tage-Durchschnitt: 0,10 bedeutet, dass das Asset nur an 10&nbsp;% aller Tage noch günstiger zu
            seinem Trend stand. <b class="text-fg">Risk</b> (Bitcoin, Ethereum) nutzt einen mehrjährigen Durchschnitt
            und gewichtet ihn über die Zeit, damit die von Zyklus zu Zyklus schrumpfenden Ausschläge
            vergleichbar bleiben: 0 entspricht dem Niveau historischer Böden, 1 dem historischer Tops.</p>
          </div>
        </div>

        <p class="mt-5 max-w-4xl">Der <b class="text-fg">KI-Blasen-Score</b> mittelt bis zu fünf dieser
        Perzentile: Nasdaq-Trend, Trend des KI-Baskets, dessen Vorsprung vor dem S&amp;P 500, die
        Marktkonzentration (SPY/RSP) und den Kredit-Risikoappetit (HYG/LQD).</p>

        <p class="mt-3 max-w-4xl">Datenquellen: Coin Metrics und CoinGecko für Krypto, Yahoo Finance mit Stooq
        als Ersatzquelle für Metalle, Aktien und Währungen. Die Werte werden einmal täglich vorberechnet und
        unverändert ausgeliefert. <b class="text-fg">Keine Anlageberatung</b> — statistische Modelle ohne
        Gewähr, jede Entscheidung liegt bei dir.</p>

        <nav class="flex gap-x-5 gap-y-2 flex-wrap mt-6 pt-5 border-t border-line font-mono text-[12px]"
             aria-label="Rechtliches und Quellen">
          <a routerLink="/impressum" class="text-muted hover:text-fg no-underline transition-colors">Impressum</a>
          <a routerLink="/datenschutz" class="text-muted hover:text-fg no-underline transition-colors">Datenschutz</a>
          <a href="/docs.html" class="text-muted hover:text-fg no-underline transition-colors">Handbuch</a>
          <a href="/snapshot.json" class="text-muted hover:text-fg no-underline transition-colors">Rohdaten (JSON)</a>
          <a href="https://github.com/Jonesxxl/market-dashboard" target="_blank" rel="noopener"
             class="text-muted hover:text-fg no-underline transition-colors">Quellcode ↗</a>
        </nav>
      </footer>
    </div>
  `,
})
export class AppComponent {
  protected data = inject(MarketDataService);
  private router = inject(Router);

  protected readonly stamp = computed(() => {
    const g = this.data.generatedAt();
    return g ? 'Snapshot vom ' + new Date(g).toLocaleString('de-DE') : '–';
  });
  protected readonly bootstrapDate = computed(() => {
    const g = this.data.generatedAt();
    return g ? new Date(g).toLocaleDateString('de-DE') : '–';
  });
  protected readonly isError = computed(() =>
    this.data.error() !== null || this.data.failed().length > 0 || this.data.ageDays() > 2);
  protected readonly statusText = computed<string | null>(() => {
    if (this.data.loading()) return 'Daten werden geladen …';
    const err = this.data.error();
    if (err) return err + ' Der tägliche Berechnungslauf legt die Daten unter /snapshot.json ab.';
    const parts: string[] = [];
    const age = this.data.ageDays();
    if (!this.data.isBootstrap() && age > 2) {
      parts.push(`Der letzte vollständige Berechnungslauf liegt ${age} Tage zurück — die Werte sind entsprechend alt.`);
    }
    const f = this.data.failed();
    if (f.length) {
      parts.push(`Beim letzten Lauf nicht aktualisiert: ${f.join(', ')}. Diese Karten zeigen den zuletzt bekannten Stand.`);
    }
    return parts.length ? parts.join(' ') : null;
  });

  constructor() {
    this.router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd && window.goatcounter) {
        window.goatcounter.count({ path: ev.urlAfterRedirects });
      }
    });
  }

  protected reload(): void { this.data.reload(); }
  protected readonly fmt = fmt;
}
