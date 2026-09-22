import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PALETTE } from '../../../metrics-core/palette';
import { RailComponent } from '../shared/ui';
import { MetricListComponent } from '../shared/metric-list.component';
import { MarketDataService } from '../core/market-data.service';

/** Einordnung des Blasen-Scores, von oben nach unten geprüft: die erste Stufe, deren
 *  Schwelle der Score überschreitet, gilt. */
const STUFEN: { ab: number; titel: string; text: string; farbe: string }[] = [
  { ab: 0.85, farbe: PALETTE.hi, titel: 'Blasen-Regime.',
    text: 'Die KI-Aktien sind gleichzeitig weit über ihrem eigenen Trend UND laufen dem Restmarkt extrem davon. Das heißt nicht, dass es morgen kracht — aber wer jetzt neu einsteigt, kauft zu historisch schlechten Konditionen.' },
  { ab: 0.6, farbe: PALETTE.mid, titel: 'Heißgelaufen, aber kein Extrem.',
    text: 'Der KI-Sektor trägt den Markt und ist teurer als üblich. Bestehende Positionen laufen lassen, bei Neukäufen wählerisch sein.' },
  { ab: 0.35, farbe: PALETTE.lo, titel: 'Neutral.',
    text: 'Weder Euphorie noch Panik in den Daten — der Score liefert gerade kein Timing-Signal.' },
  { ab: -Infinity, farbe: PALETTE.lo, titel: 'Ausgewaschen.',
    text: 'Die Komponenten notieren ungewöhnlich tief. Historisch war das die Zone, in der geduldige Käufer belohnt wurden.' },
];

@Component({
  selector: 'app-ai',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RailComponent, MetricListComponent],
  template: `
    @if (score(); as sc) {
      <div class="card p-6 mb-4">
        <h2 class="card-title">KI-Blasen-Score</h2>
        <div class="flex items-center gap-6 flex-wrap">
          <div class="font-mono text-[52px] font-semibold leading-none" [style.color]="sc.stufe.farbe">{{ sc.score.toFixed(2) }}</div>
          <div class="text-[13px] text-muted max-w-xl leading-relaxed">
            <b class="text-fg">{{ sc.stufe.titel }}</b> {{ sc.stufe.text }}<br><br>
            Der Score ist der Mittelwert aus {{ sc.comps.length }} Fragen, jede als historisches Perzentil von 0 bis 1:
            @for (c of sc.comps; track c[0]) {
              <span>{{ c[2] }} <b class="text-fg">{{ c[1].toFixed(2) }}</b>{{ !$last ? ' · ' : '' }}</span>
            }
          </div>
        </div>
        <app-rail [value]="sc.score"/>
      </div>
    }
    <app-metric-list [metrics]="aiMetrics()" [skeletonCount]="4"/>
  `,
})
export class AiComponent {
  private data = inject(MarketDataService);

  protected readonly aiMetrics = computed(() =>
    this.data.byIds(['ndx-heat', 'ai-basket-heat', 'conc-heat', 'credit-heat']));

  protected readonly score = computed(() => {
    const b = this.data.bubble();
    if (!b) return null;
    return { ...b, stufe: STUFEN.find(s => b.score > s.ab) ?? STUFEN[STUFEN.length - 1] };
  });
}
