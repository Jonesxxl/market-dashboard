import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Routes, RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MarketDataService, fmt } from './core/market-data.service';

declare global {
  interface Window { goatcounter?: { count: (opts: { path: string }) => void }; }
}

/* ===== Routen ===== */
/* `title` wird von der AppTitleStrategy (src/main.ts) um den Seitennamen ergänzt —
   ohne das teilen sich alle Routen denselben Titel in Tab, Verlauf und Suchergebnis. */
export const routes: Routes = [
  { path: '', title: '', loadComponent: () => import('./pages/landing.component').then(m => m.LandingComponent) },
  { path: 'krypto', title: 'Krypto — Bitcoin & Ethereum Risk-Metrik', loadComponent: () => import('./pages/crypto.component').then(m => m.CryptoComponent) },
  { path: 'metalle', title: 'Metalle — Gold, Silber & Palladium', loadComponent: () => import('./pages/metals.component').then(m => m.MetalsComponent) },
  { path: 'nasdaq-ki', title: 'Nasdaq & KI — Blasen-Score', loadComponent: () => import('./pages/ai.component').then(m => m.AiComponent) },
  { path: 'waehrungen', title: 'Währungen — Dollar-Index & Paare', loadComponent: () => import('./pages/fx.component').then(m => m.FxComponent) },
  { path: 'generator', title: 'Sparplan- & Rebalancing-Generator', loadComponent: () => import('./pages/generator.component').then(m => m.GeneratorComponent) },
  { path: 'impressum', title: 'Impressum', loadComponent: () => import('./pages/impressum.component').then(m => m.ImpressumComponent) },
  { path: 'datenschutz', title: 'Datenschutz', loadComponent: () => import('./pages/datenschutz.component').then(m => m.DatenschutzComponent) },
  { path: '**', redirectTo: '' },
];

/* ===== Shell ===== */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="max-w-[1100px] mx-auto px-5 pb-16 pt-7">
      <header class="flex justify-between items-end gap-4 flex-wrap mb-5">
        <a routerLink="/" class="no-underline">
          <h1 class="text-[22px] font-bold text-fg">Macro Risk Dashboard</h1>
          <p class="text-xs text-muted mt-1">Wie günstig oder teuer sind Bitcoin, Ethereum, Edelmetalle, Nasdaq
            und die großen Währungen — gemessen an ihrer eigenen Geschichte? Täglich neu berechnet.</p>
        </a>
        <div class="text-right font-mono text-xs text-muted">
          <div>{{ stamp() }}</div>
          <button type="button" (click)="reload()" [disabled]="data.loading()"
            class="mt-1.5 bg-panel border border-line text-fg font-mono text-xs px-3.5 py-1.5 rounded-lg hover:border-muted disabled:opacity-50"
            aria-label="Neu laden">
            {{ data.loading() ? 'Lädt …' : 'Neu laden' }}
          </button>
        </div>
      </header>

      @if (data.isBootstrap()) {
        <div class="font-mono text-[13px] px-4 py-3.5 border border-dashed border-mid rounded-xl mb-5 text-mid"
             role="status">
          <b>Demo-Daten aus dem Build-Paket</b> (Stand {{ bootstrapDate() }}) — der tägliche Berechnungslauf hat noch
          nie erfolgreich geschrieben. Sobald die GitHub-Action „Täglicher Metrik-Snapshot" einmal durchläuft und
          deployt wird, ersetzt sie diese Datei durch echte Tageskurse.
        </div>
      } @else if (statusText(); as st) {
        <div class="font-mono text-[13px] px-4 py-3.5 border border-dashed rounded-xl mb-5"
             [class.text-muted]="!isError()" [class.border-line]="!isError()"
             [class.text-red-300]="isError()" [class.border-red-900]="isError()"
             role="status" aria-live="polite">{{ st }}</div>
      }

      <nav class="flex gap-2 mb-5 flex-wrap items-center" aria-label="Hauptnavigation">
        <a routerLink="/" routerLinkActive="!text-fg !border-muted !bg-panel" [routerLinkActiveOptions]="{ exact: true }"
           class="bg-panel2 border border-line text-muted font-mono text-[12.5px] px-4 py-2 rounded-[9px] no-underline">Start</a>
        <a routerLink="/krypto" routerLinkActive="!text-fg !border-muted !bg-panel"
           class="bg-panel2 border border-line text-muted font-mono text-[12.5px] px-4 py-2 rounded-[9px] no-underline">Krypto</a>
        <a routerLink="/metalle" routerLinkActive="!text-fg !border-muted !bg-panel"
           class="bg-panel2 border border-line text-muted font-mono text-[12.5px] px-4 py-2 rounded-[9px] no-underline">Metalle</a>
        <a routerLink="/nasdaq-ki" routerLinkActive="!text-fg !border-muted !bg-panel"
           class="bg-panel2 border border-line text-muted font-mono text-[12.5px] px-4 py-2 rounded-[9px] no-underline">Nasdaq &amp; KI</a>
        <a routerLink="/waehrungen" routerLinkActive="!text-fg !border-muted !bg-panel"
           class="bg-panel2 border border-line text-muted font-mono text-[12.5px] px-4 py-2 rounded-[9px] no-underline">Währungen</a>
        <a routerLink="/generator" routerLinkActive="!text-fg !border-muted !bg-panel"
           class="bg-panel2 border border-line text-muted font-mono text-[12.5px] px-4 py-2 rounded-[9px] no-underline">Generator</a>
        <a href="/docs.html" target="_blank" rel="noopener"
           class="ml-auto bg-panel2 border border-line text-muted font-mono text-[12.5px] px-4 py-2 rounded-[9px] no-underline">Doku ↗</a>
      </nav>

      <main><router-outlet/></main>

      <footer class="text-xs text-muted leading-relaxed mt-8 border-t border-line pt-5">
        <b class="text-fg">Wie wird gerechnet?</b> Jedes Asset wird nur mit sich selbst verglichen: Wie weit liegt
        der Kurs über oder unter seinem eigenen langfristigen Durchschnitt — und wie oft kam so eine Abweichung in
        der gesamten Historie vor? Bei Krypto (Zyklus-Risk-Metrik: 374-Tage-Schnitt, zeitgewichtet, damit die
        schrumpfenden Zyklusamplituden vergleichbar bleiben) bedeutet 0 „Niveau historischer Böden" und 1 „Niveau
        historischer Tops". Bei Metallen, Aktien und Währungen (Heat, 200-Tage-Schnitt) ist der Wert ein Perzentil:
        Heat 0,10 heißt, nur an 10&nbsp;% aller Tage war das Asset noch günstiger zu seinem Trend. Der KI-Blasen-Score
        mittelt bis zu fünf Perzentile: Nasdaq-Trend, KI-Basket-Trend, Vorsprung des Baskets vor dem S&amp;P 500,
        Marktkonzentration (SPY/RSP) und Kredit-Risikoappetit (HYG/LQD). Datenquellen: Coin Metrics &amp; CoinGecko
        (Krypto), Yahoo Finance mit Stooq als Ersatz (Metalle, Aktien, Währungen). Keine Anlageberatung.

        <nav class="flex gap-4 flex-wrap mt-5 font-mono text-[12px]" aria-label="Rechtliches">
          <a routerLink="/impressum" class="text-muted hover:text-fg no-underline">Impressum</a>
          <a routerLink="/datenschutz" class="text-muted hover:text-fg no-underline">Datenschutz</a>
          <a href="/snapshot.json" class="text-muted hover:text-fg no-underline">Rohdaten (JSON)</a>
          <a href="https://github.com/Jonesxxl/market-dashboard" target="_blank" rel="noopener"
             class="text-muted hover:text-fg no-underline">Quellcode ↗</a>
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
    if (this.data.loading()) return 'Lade Snapshot …';
    const err = this.data.error();
    if (err) return err + ' Der tägliche Berechnungslauf legt ihn unter /snapshot.json ab.';
    const parts: string[] = [];
    if (!this.data.isBootstrap() && this.data.ageDays() > 2) parts.push(`Snapshot ist ${this.data.ageDays()} Tage alt — der tägliche Lauf scheint zu hängen.`);
    const f = this.data.failed();
    if (f.length) parts.push('Im letzten Lauf ausgefallen: ' + f.join(', ') + '.');
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
