import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChartComponent, RailComponent } from '../shared/ui';
import { MetricCardComponent } from '../shared/metric-card.component';
import { sparklineSvg, TipData } from '../core/charts';
import { fmt, MarketDataService, RatioSnapshot } from '../core/market-data.service';

interface RatioVm extends RatioSnapshot {
  noteHtml: SafeHtml;
  chart: { svg: string; tip: TipData } | null;
}

@Component({
  selector: 'app-metals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent, RailComponent, MetricCardComponent],
  template: `
    @for (m of metalMetrics(); track m.id) { <app-metric-card [m]="m"/> }
      @empty {
        <div class="bg-panel border border-dashed border-line rounded-2xl p-6 mb-4 text-muted text-[13.5px]">
          Für diesen Bereich liegen noch keine Daten im Snapshot — der tägliche Berechnungslauf
          (GitHub Action) füllt ihn beim nächsten erfolgreichen Durchgang automatisch.
        </div>
      }
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      @for (r of ratios(); track r.id) {
        <div class="bg-panel border border-line rounded-2xl p-6">
          <h2 class="text-[13px] font-bold tracking-widest uppercase text-muted mb-3.5">{{ r.title }}</h2>
          <div class="font-mono text-[34px] font-semibold leading-none my-1">
            {{ fmt(r.cur, 1) }}
            <span class="text-xs text-muted font-normal ml-2">aktuell · Median {{ fmt(r.med, 1) }} · Perzentil {{ (r.pct * 100).toFixed(0) }} %</span>
          </div>
          <app-rail [value]="r.pct"/>
          <p class="text-[13.5px] text-muted mt-2.5" [innerHTML]="r.noteHtml"></p>
          @if (r.chart) { <app-chart [svg]="r.chart.svg" [tip]="r.chart.tip"/> }
        </div>
      }
    </div>
  `,
})
export class MetalsComponent {
  private data = inject(MarketDataService);
  private sanitizer = inject(DomSanitizer);
  protected readonly fmt = fmt;

  protected readonly metalMetrics = computed(() =>
    this.data.metrics().filter(m => m.assetClass === 'metal'));

  protected readonly ratios = computed<RatioVm[]>(() =>
    this.data.ratios().map(r => ({
      ...r,
      noteHtml: this.sanitizer.bypassSecurityTrustHtml(r.note.replaceAll('<b>', '<b class="text-fg">')),
      chart: sparklineSvg(r.series.months, r.series.pct, '#8A97AC', 6, 'Perzentil', r.series.vals, ''),
    })));
}
