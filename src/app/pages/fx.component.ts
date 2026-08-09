import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MetricCardComponent } from '../shared/metric-card.component';
import { MarketDataService } from '../core/market-data.service';

@Component({
  selector: 'app-fx',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MetricCardComponent],
  template: `
    <div class="bg-panel border border-line rounded-2xl px-6 py-5 mb-4">
      <p class="text-[13.5px] text-muted leading-relaxed">
        <b class="text-fg">Alle Paare notieren den Dollar als Basiswährung.</b> Eine steigende Kurve bedeutet
        deshalb ausnahmslos: Der Dollar gewinnt gegenüber der jeweiligen Währung. Aus diesem Grund wird auch das
        gewohnte EUR/USD hier als USD/EUR dargestellt — sonst liefe genau dieses eine Paar der Leserichtung aller
        anderen entgegen.
      </p>
      <p class="text-[13.5px] text-muted leading-relaxed mt-3">
        Heat misst wie überall im Dashboard, wie weit der aktuelle Stand vom eigenen 200-Tage-Trend abweicht.
        Währungen kennen keine Kaufzonen wie Aktien — bei ihnen sind die Extreme das Signal: Werte unter 0,15 oder
        über 0,85 markieren stark gedehnte Bewegungen, die in der Vergangenheit häufig zurückliefen.
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
