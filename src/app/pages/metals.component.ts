import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PALETTE } from '../../../metrics-core/palette';
import { ChartComponent, RailComponent } from '../shared/ui';
import { MetricListComponent } from '../shared/metric-list.component';
import { ChartSvg, sparklineSvg } from '../core/charts';
import { fmt, MarketDataService, RatioSnapshot } from '../core/market-data.service';

interface RatioVm extends RatioSnapshot { chart: ChartSvg | null; }

@Component({
  selector: 'app-metals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent, RailComponent, MetricListComponent],
  template: `
    <app-metric-list [metrics]="metalMetrics()" [skeletonCount]="3"/>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      @for (r of ratios(); track r.id) {
        <div class="card p-6">
          <h2 class="card-title">{{ r.title }}</h2>
          <div class="font-mono text-[34px] font-semibold leading-none my-1">
            {{ fmt(r.cur, 1) }}
            <span class="text-xs text-muted font-normal ml-2">aktuell · Median {{ fmt(r.med, 1) }} · Perzentil {{ (r.pct * 100).toFixed(0) }} %</span>
          </div>
          <app-rail [value]="r.pct"/>
          <p class="text-[13.5px] text-muted mt-2.5 [&_b]:text-fg" [innerHTML]="r.note"></p>
          @if (r.chart) { <app-chart [svg]="r.chart.svg" [tip]="r.chart.tip"/> }
        </div>
      }
    </div>
  `,
})
export class MetalsComponent {
  private data = inject(MarketDataService);
  protected readonly fmt = fmt;

  protected readonly metalMetrics = computed(() =>
    this.data.metrics().filter(m => m.assetClass === 'metal'));

  protected readonly ratios = computed<RatioVm[]>(() =>
    this.data.ratios().map(r => ({
      ...r,
      chart: sparklineSvg({
        dates: r.series.months, values: r.series.pct, color: PALETTE.muted,
        label: 'Perzentil', prices: r.series.vals,
      }),
    })));
}
