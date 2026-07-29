import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MetricCardComponent } from '../shared/metric-card.component';
import { MarketDataService } from '../core/market-data.service';

@Component({
  selector: 'app-fx',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MetricCardComponent],
  template: `
    <div class="bg-panel border border-line rounded-2xl px-6 py-4 mb-4">
      <p class="text-[13.5px] text-muted leading-relaxed">
        Alle Paare aus Dollar-Sicht: Steigt die Kurve, wird der Dollar gegenüber der jeweiligen Währung
        <b class="text-fg">stärker</b> (Ausnahme EUR/USD: dort heißt steigend Euro-Stärke). Heat misst wie überall
        im Dashboard, wie extrem der aktuelle Stand relativ zum eigenen 200-Tage-Trend ist — Währungen kennen keine
        „Kaufzonen" wie Aktien, aber Extreme (unter 0,15 / über 0,85) markieren gedehnte Bewegungen, die historisch
        oft zurückschwangen.
      </p>
    </div>
    @for (m of fxMetrics(); track m.id) { <app-metric-card [m]="m"/> }
      @empty {
        <div class="bg-panel border border-dashed border-line rounded-2xl p-6 mb-4 text-muted text-[13.5px]">
          Für diesen Bereich liegen noch keine Daten im Snapshot — der tägliche Berechnungslauf
          (GitHub Action) füllt ihn beim nächsten erfolgreichen Durchgang automatisch.
        </div>
      }
  `,
})
export class FxComponent {
  private data = inject(MarketDataService);
  protected readonly fxMetrics = computed(() =>
    this.data.metrics().filter(m => m.assetClass === 'fx'));
}
