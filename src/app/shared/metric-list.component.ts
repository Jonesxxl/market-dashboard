import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MarketDataService, MetricSnapshot } from '../core/market-data.service';
import { MetricCardComponent } from './metric-card.component';
import { MetricSkeletonComponent } from './ui';

/** Die Karten eines Bereichs mit allen drei Zuständen: Platzhalter beim ersten Laden,
 *  die Karten selbst, und ein ehrlicher Hinweis, wenn der Snapshot für diesen Bereich
 *  nichts enthält. Vorher stand dieser Block wortgleich auf vier Seiten. */
@Component({
  selector: 'app-metric-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MetricCardComponent, MetricSkeletonComponent],
  template: `
    @if (loading() && !metrics().length) {
      <app-metric-skeleton [count]="skeletonCount()"/>
    } @else {
      @for (m of metrics(); track m.id) { <app-metric-card [m]="m"/> }
      @empty {
        <div class="card border-dashed p-6 mb-4 text-muted text-[13.5px]">
          Für diesen Bereich liegen noch keine Daten im Snapshot — der automatische Berechnungslauf
          (GitHub Action) füllt ihn beim nächsten erfolgreichen Durchgang automatisch.
        </div>
      }
    }
  `,
})
export class MetricListComponent {
  metrics = input.required<MetricSnapshot[]>();
  /** Wie viele Platzhalterkarten beim ersten Laden erscheinen — so viele, wie die Seite
   *  üblicherweise zeigt, damit die Höhe beim Eintreffen der Daten nicht springt. */
  skeletonCount = input(3);
  protected readonly loading = inject(MarketDataService).loading;
}
