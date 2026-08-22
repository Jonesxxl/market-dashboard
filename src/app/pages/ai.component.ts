import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MetricSkeletonComponent, RailComponent } from '../shared/ui';
import { MetricCardComponent } from '../shared/metric-card.component';
import { MarketDataService } from '../core/market-data.service';

@Component({
  selector: 'app-ai',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RailComponent, MetricCardComponent, MetricSkeletonComponent],
  template: `
    @if (score(); as sc) {
      <div class="bg-panel border border-line rounded-2xl p-6 mb-4">
        <h2 class="text-[13px] font-bold tracking-widest uppercase text-muted mb-3.5">KI-Blasen-Score</h2>
        <div class="flex items-center gap-6 flex-wrap">
          <div class="font-mono text-[52px] font-semibold leading-none" [style.color]="sc.color">{{ sc.score.toFixed(2) }}</div>
          <div class="text-[13px] text-muted max-w-xl leading-relaxed">
            <span [innerHTML]="sc.verdictHtml"></span><br><br>
            Der Score ist der Mittelwert aus {{ sc.comps.length }} Fragen, jede als historisches Perzentil von 0 bis 1:
            @for (c of sc.comps; track c[0]) {
              <span>{{ c[2] }} <b class="text-fg">{{ c[1].toFixed(2) }}</b>{{ !$last ? ' · ' : '' }}</span>
            }
          </div>
        </div>
        <app-rail [value]="sc.score"/>
      </div>
    }
    @if (data.loading() && !aiMetrics().length) {
      <app-metric-skeleton [count]="4"/>
    } @else {
      @for (m of aiMetrics(); track m.id) { <app-metric-card [m]="m"/> }
      @empty {
        <div class="bg-panel border border-dashed border-line rounded-2xl p-6 mb-4 text-muted text-[13.5px]">
          Für diesen Bereich liegen noch keine Daten im Snapshot — der tägliche Berechnungslauf
          (GitHub Action) füllt ihn beim nächsten erfolgreichen Durchgang automatisch.
        </div>
      }
    }
  `,
})
export class AiComponent {
  protected data = inject(MarketDataService);
  private sanitizer = inject(DomSanitizer);

  protected readonly aiMetrics = computed(() =>
    this.data.byIds(['ndx-heat', 'ai-basket-heat', 'conc-heat', 'credit-heat']));

  protected readonly score = computed(() => {
    const b = this.data.bubble();
    if (!b) return null;
    const s = b.score;
    const verdict = s > 0.85
      ? '<b>Blasen-Regime.</b> Die KI-Aktien sind gleichzeitig weit über ihrem eigenen Trend UND laufen dem Restmarkt extrem davon. Das heißt nicht, dass es morgen kracht — aber wer jetzt neu einsteigt, kauft zu historisch schlechten Konditionen.'
      : s > 0.6
      ? '<b>Heißgelaufen, aber kein Extrem.</b> Der KI-Sektor trägt den Markt und ist teurer als üblich. Bestehende Positionen laufen lassen, bei Neukäufen wählerisch sein.'
      : s > 0.35
      ? '<b>Neutral.</b> Weder Euphorie noch Panik in den Daten — der Score liefert gerade kein Timing-Signal.'
      : '<b>Ausgewaschen.</b> Die Komponenten notieren ungewöhnlich tief. Historisch war das die Zone, in der geduldige Käufer belohnt wurden.';
    return {
      ...b,
      verdictHtml: this.sanitizer.bypassSecurityTrustHtml(verdict.replaceAll('<b>', '<b class="text-fg">')) as SafeHtml,
      color: s > 0.85 ? '#F0533F' : s > 0.6 ? '#F2B33D' : '#22C6B8',
    };
  });
}
