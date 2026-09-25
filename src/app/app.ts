import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Route, Routes, RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { PAGES, PagePath, SNAPSHOT_INTERVAL_DAYS } from '../../metrics-core/site';
import { MarketDataService } from './core/market-data.service';

declare global {
  interface Window { goatcounter?: { count: (opts: { path: string }) => void }; }
}

/* ===== Routen ===== */
/* Titel und Beschreibung stehen in metrics-core/site.ts, weil der Generator der statischen
   Seiten dieselben Texte braucht. Die AppTitleStrategy (src/app/core/title-strategy.ts)
   macht daraus Titel, Meta-Beschreibung, OG-Tags und Canonical. */
const page = (path: PagePath, loadComponent: Route['loadComponent']): Route => ({
  path, title: PAGES[path].title, data: { description: PAGES[path].description }, loadComponent,
});

export const routes: Routes = [
  { path: '', title: '', loadComponent: () => import('./pages/landing.component').then(m => m.LandingComponent) },
  page('krypto', () => import('./pages/crypto.component').then(m => m.CryptoComponent)),
  page('metalle', () => import('./pages/metals.component').then(m => m.MetalsComponent)),
  page('nasdaq-ki', () => import('./pages/ai.component').then(m => m.AiComponent)),
  page('waehrungen', () => import('./pages/fx.component').then(m => m.FxComponent)),
  page('generator', () => import('./pages/generator.component').then(m => m.GeneratorComponent)),
  page('impressum', () => import('./pages/impressum.component').then(m => m.ImpressumComponent)),
  page('datenschutz', () => import('./pages/datenschutz.component').then(m => m.DatenschutzComponent)),
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
          <b>Beispieldaten aus dem Build-Paket</b> (Stand {{ bootstrapDate() }}) — der automatische Berechnungslauf
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
        als Ersatzquelle für Metalle, Aktien und Währungen. Die Werte werden alle zwei Tage vorberechnet und
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
    if (!g) return '–';
    const d = new Date(g);
    return `Daten vom ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}, `
      + `${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
  });
  protected readonly bootstrapDate = computed(() => {
    const g = this.data.generatedAt();
    return g ? new Date(g).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
  });
  protected readonly isError = computed(() =>
    this.data.error() !== null || this.data.failed().length > 0 || this.veraltet());
  /** Veraltet erst nach zwei Takten: Ein einzelner ausgefallener Lauf bleibt still, wie schon
   *  beim früheren täglichen Takt (Schwelle 2 Tage). Hätte die feste 2 überlebt, löste im
   *  2-Tage-Takt schon ein einziger ausgefallener Lauf die Warnung aus. */
  private readonly veraltet = computed(() =>
    !this.data.isBootstrap() && this.data.ageDays() > 2 * SNAPSHOT_INTERVAL_DAYS);
  protected readonly statusText = computed<string | null>(() => {
    if (this.data.loading()) return 'Daten werden geladen …';
    const err = this.data.error();
    if (err) return err + ' Der automatische Berechnungslauf legt die Daten unter /snapshot.json ab.';
    const parts: string[] = [];
    if (this.veraltet()) {
      parts.push(`Der letzte vollständige Berechnungslauf liegt ${this.data.ageDays()} Tage zurück — die Werte sind entsprechend alt.`);
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
}
