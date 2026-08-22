import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { priceSparklineSvg, sparklineSvg, TipData } from '../core/charts';
import { fmt, MarketDataService, MetricSnapshot } from '../core/market-data.service';
import { ChartComponent, RailComponent } from './ui';

/** Eine Karte für jede Registry-Metrik — Statistikzeile variiert je Assetklasse. */
@Component({
  selector: 'app-metric-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent, RailComponent],
  template: `
    <div class="bg-panel border border-line rounded-2xl p-6 mb-4">
      <div class="flex justify-between items-baseline flex-wrap gap-2.5 mb-3">
        <div class="font-bold text-[15px]">
          <span class="inline-block w-2.5 h-2.5 rounded-full mr-2" [style.background]="m().hex"></span>
          {{ m().label }}@if (m().sym !== m().label) { · {{ m().sym }} }
        </div>
        <div class="font-mono text-xs text-muted flex gap-3.5 flex-wrap" [innerHTML]="statsLine()"></div>
      </div>
      @if (!isBootstrap() && m().current.staleDays > 3) {
        <div class="text-[13.5px] text-muted border-l-[3px] border-hi pl-3 mb-2" role="alert">
          ⚠ <b class="text-fg">Kurs {{ m().current.staleDays }} Tage alt</b> — der letzte Snapshot-Lauf
          konnte diese Quelle nicht aktualisieren.
        </div>
      }
      <div class="font-mono text-[34px] font-semibold leading-none my-1">
        {{ m().kind === 'risk' ? m().current.value.toFixed(3) : m().current.value.toFixed(2) }}
        <span class="text-xs text-muted font-normal ml-2">{{ scaleLabel() }}</span>
      </div>
      <p class="text-[13.5px] text-muted mb-2" [innerHTML]="interpretHtml()"></p>
      <app-rail [value]="m().current.value" [ghosts]="m().extra?.ghosts ?? []"
        [zones]="zoneTriples()" [hotAbove]="m().hotAbove"/>
      @if (chart(); as c) { <app-chart [svg]="c.svg" [tip]="c.tip"/> }
      @if (priceChart(); as pc) {
        <div class="mt-4 pt-4 border-t border-line">
          <app-chart [svg]="pc.svg" [tip]="pc.tip"/>
          @if (m().extra?.priceNote; as note) {
            <p class="font-mono text-[11px] text-faint mt-2">{{ note }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class MetricCardComponent {
  private sanitizer = inject(DomSanitizer);
  private data = inject(MarketDataService);
  protected readonly isBootstrap = this.data.isBootstrap;
  m = input.required<MetricSnapshot>();

  protected readonly scaleLabel = computed(() =>
    this.m().extra?.valueLabel
      ?? (this.m().kind === 'risk'
        ? 'Risk · 0 = Niveau historischer Böden · 1 = Niveau historischer Tops'
        : this.m().assetClass === 'fx'
          ? 'Heat · 0 = historisch tiefst zum Trend · 1 = historisch höchst'
          : 'Heat · 0 = historisch billigst zum Trend · 1 = historisch teuerst'));

  protected readonly interpretHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.m().interpret.replaceAll('<b>', '<b class="text-fg">')));

  protected readonly zoneTriples = computed<[string, string, number][]>(() =>
    this.m().zones.map(z => [z.label, z.text, z.below]));

  protected readonly statsLine = computed<SafeHtml>(() => {
    const m = this.m();
    const b = (s: string) => `<b class="text-fg">${s}</b>`;
    const parts: string[] = [];
    const unit = m.unit ? ' ' + m.unit : '';
    parts.push(`<span>${m.extra?.priceLabel ?? 'Kurs'} ${b(fmt(m.current.price, m.dec) + unit)}</span>`);
    parts.push(`<span>${m.kind === 'risk' ? '374' : '200'}-Tage-Schnitt ${b(fmt(m.current.sma, m.dec))}</span>`);
    if (m.assetClass !== 'fx' && !m.extra?.hideAth) parts.push(`<span>vom Höchststand ${b(fmt(m.stats.vsAth, 1) + ' %')}</span>`);
    parts.push(`<span>52-Wochen-Spanne ${b(fmt(m.stats.lo52, m.dec) + '–' + fmt(m.stats.hi52, m.dec))}</span>`);
    parts.push(`<span>Stand ${b(m.current.date)}</span>`);
    return this.sanitizer.bypassSecurityTrustHtml(parts.join(' '));
  });

  protected readonly chart = computed<{ svg: string; tip: TipData } | null>(() => {
    const m = this.m();
    // Zonenlinien nur, wo die Metrik auch Zonen definiert — sonst behauptet der Chart
    // Kauf- und Warnbereiche, die es bei Währungen ausdrücklich nicht gibt.
    const hasZones = m.zones.length > 0 || m.hotAbove !== null;
    return sparklineSvg(m.series.months, m.series.values, m.hex, 6,
      m.kind === 'risk' ? 'Risk' : 'Heat', m.series.prices, m.unit, m.dec, hasZones);
  });

  /** Zusätzlicher Kursverlauf — nur wo der Heat-Wert allein den Kurs nicht erkennen lässt. */
  protected readonly priceChart = computed<{ svg: string; tip: TipData } | null>(() => {
    const m = this.m();
    if (!m.extra?.priceChart) return null;
    return priceSparklineSvg(m.series.months, m.series.prices, m.hex, 6,
      m.extra.priceLabel ?? 'Kurs', m.unit, m.dec);
  });
}
