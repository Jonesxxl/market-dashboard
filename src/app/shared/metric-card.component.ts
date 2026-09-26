import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { formatValue, kindLabel } from '../../../metrics-core/math';
import { ChartSvg, priceSparklineSvg, sparklineSvg } from '../core/charts';
import { fmt, MarketDataService, MetricSnapshot } from '../core/market-data.service';
import { ChartComponent, RailComponent } from './ui';

/** Eine Karte für jede Registry-Metrik — Statistikzeile variiert je Assetklasse.
 *
 *  Texte aus dem Snapshot (`interpret`) tragen `<b>`-Auszeichnung. Sie laufen durch Angulars
 *  Standard-Bereinigung (`[innerHTML]` ohne Bypass) und bekommen ihre Farbe über
 *  `[&_b]:text-fg` am Absatz — die Daten kommen von einer externen URL und werden deshalb
 *  nicht mehr ungeprüft als vertrauenswürdig markiert. */
@Component({
  selector: 'app-metric-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent, RailComponent],
  template: `
    <div class="card p-6 mb-4">
      <div class="flex justify-between items-baseline flex-wrap gap-2.5 mb-3">
        <div class="font-bold text-[15px]">
          <span class="inline-block w-2.5 h-2.5 rounded-full mr-2" [style.background]="m().hex"></span>
          {{ m().label }}@if (m().sym !== m().label) { · {{ m().sym }} }
        </div>
        <div class="font-mono text-xs text-muted flex gap-3.5 flex-wrap">
          @for (s of stats(); track s.label) {
            <span>{{ s.label }} <b class="text-fg">{{ s.value }}</b></span>
          }
        </div>
      </div>
      @if (!isBootstrap() && m().current.staleDays > 3) {
        <div class="text-[13.5px] text-muted border-l-[3px] border-hi pl-3 mb-2" role="alert">
          ⚠ <b class="text-fg">Kurs {{ m().current.staleDays }} Tage alt</b> — der letzte Snapshot-Lauf
          konnte diese Quelle nicht aktualisieren.
        </div>
      }
      <div class="font-mono text-[34px] font-semibold leading-none my-1">
        {{ value() }}
        <span class="text-xs text-muted font-normal ml-2">{{ scaleLabel() }}</span>
      </div>
      <p class="text-[13.5px] text-muted mb-2 [&_b]:text-fg" [innerHTML]="m().interpret"></p>
      <app-rail [value]="m().current.value" [ghosts]="m().extra?.ghosts ?? []"
        [zones]="m().zones" [hotAbove]="m().hotAbove"/>
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
  protected readonly isBootstrap = inject(MarketDataService).isBootstrap;
  m = input.required<MetricSnapshot>();

  protected readonly value = computed(() => formatValue(this.m().kind, this.m().current.value));

  protected readonly scaleLabel = computed(() => {
    const m = this.m();
    if (m.extra?.valueLabel) return m.extra.valueLabel;
    if (m.kind === 'risk') return 'Risk · 0 = Niveau historischer Böden · 1 = Niveau historischer Tops';
    return m.assetClass === 'fx'
      ? 'Heat · 0 = historisch tiefst zum Trend · 1 = historisch höchst'
      : 'Heat · 0 = historisch billigst zum Trend · 1 = historisch teuerst';
  });

  /** Statistikzeile als Daten statt als HTML-String — Angular escapt die Werte selbst. */
  protected readonly stats = computed<{ label: string; value: string }[]>(() => {
    const m = this.m();
    const unit = m.unit ? ' ' + m.unit : '';
    const out = [
      { label: m.extra?.priceLabel ?? 'Kurs', value: fmt(m.current.price, m.dec) + unit },
      { label: `${m.extra?.smaDays ?? 200}-Tage-Schnitt`, value: fmt(m.current.sma, m.dec) },
    ];
    if (m.assetClass !== 'fx' && !m.extra?.hideAth) out.push({ label: 'vom Höchststand', value: fmt(m.stats.vsAth, 1) + ' %' });
    out.push({ label: '52-Wochen-Spanne', value: fmt(m.stats.lo52, m.dec) + '–' + fmt(m.stats.hi52, m.dec) });
    out.push({ label: 'Stand', value: m.current.date });
    return out;
  });

  protected readonly chart = computed<ChartSvg | null>(() => {
    const m = this.m();
    // Zonenlinien nur, wo die Metrik auch Zonen definiert — sonst behauptet der Chart
    // Kauf- und Warnbereiche, die es bei Währungen ausdrücklich nicht gibt.
    const hasZones = m.zones.length > 0 || m.hotAbove !== null;
    return sparklineSvg({
      dates: m.series.months, values: m.series.values, color: m.hex,
      label: kindLabel(m.kind), prices: m.series.prices, unit: m.unit, dec: m.dec,
      bands: hasZones ? (m.extra?.chartBands ?? [0.15, 0.85]) : null,
    });
  });

  /** Zusätzlicher Kursverlauf — nur wo der Heat-Wert allein den Kurs nicht erkennen lässt. */
  protected readonly priceChart = computed<ChartSvg | null>(() => {
    const m = this.m();
    if (!m.extra?.priceChart) return null;
    return priceSparklineSvg({
      months: m.series.months, prices: m.series.prices, color: m.hex,
      label: m.extra.priceLabel ?? 'Kurs', unit: m.unit, dec: m.dec,
    });
  });
}
