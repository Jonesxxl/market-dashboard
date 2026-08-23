import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ChartComponent, MetricSkeletonComponent } from '../shared/ui';
import { MetricCardComponent } from '../shared/metric-card.component';
import { bearChartSvg, TipData } from '../core/charts';
import { fmt, MarketDataService } from '../core/market-data.service';

interface BearVm {
  chips: { k: string; v: string; sub: string; color?: string }[];
  charts: { name: string; hex: string; ath: string; svg: string; tip: TipData }[];
}

@Component({
  selector: 'app-crypto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent, MetricCardComponent, MetricSkeletonComponent],
  template: `
    @if (data.loading() && !cryptoMetrics().length) {
      <app-metric-skeleton [count]="4"/>
    } @else {
      @for (m of cryptoMetrics(); track m.id) { <app-metric-card [m]="m"/> }
      @empty {
        <div class="bg-panel border border-dashed border-line rounded-2xl p-6 mb-4 text-muted text-[13.5px]">
          Für diesen Bereich liegen noch keine Daten im Snapshot — der tägliche Berechnungslauf
          (GitHub Action) füllt ihn beim nächsten erfolgreichen Durchgang automatisch.
        </div>
      }
    }

    @if (bear(); as b) {
      <div class="bg-panel border border-line rounded-2xl p-6 mb-4">
        <h2 class="text-[13px] font-bold tracking-widest uppercase text-muted mb-3.5">
          Bärenmarkt-Vergleich · 2017/18 vs. 2025/26 — beide vom Allzeithoch aus, gleiche Skala</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-1.5">
          @for (chip of b.chips; track chip.k) {
            <div class="bg-panel2 border border-line rounded-xl px-3 py-2.5">
              <div class="font-mono text-[10.5px] tracking-wide uppercase text-faint mb-1">{{ chip.k }}</div>
              <div class="font-mono text-base font-semibold" [style.color]="chip.color ?? '#E8ECF3'">
                {{ chip.v }}<small class="text-[11px] text-muted font-normal ml-1">{{ chip.sub }}</small>
              </div>
            </div>
          }
        </div>
        @for (ch of b.charts; track ch.name) {
          <div class="flex justify-between items-baseline gap-2.5 flex-wrap mt-4 font-mono text-xs text-muted">
            <span class="font-sans text-[13.5px] font-bold text-fg">
              <span class="inline-block w-2 h-2 rounded-full mr-1.5" [style.background]="ch.hex"></span>{{ ch.name }}</span>
            <span>{{ ch.ath }}</span>
          </div>
          <app-chart [svg]="ch.svg" [tip]="ch.tip"/>
        }
        <p class="font-mono text-[11.5px] text-faint mt-2.5">
          Beide Kurven in Prozent des jeweiligen Allzeithochs, Tag 0 = ATH, identische Skala. Die gelbe Linie
          markiert in beiden Charts denselben Zyklustag. Verläuft die orange Kurve flacher als die graue, fällt
          dieser Zyklus milder aus (Drawdowns pro Zyklus: −84 % → −76 % → ?).
        </p>
      </div>
    }

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      @for (m of cryptoMetrics(); track m.id) {
        @if (m.extra?.riskLevels; as levels) {
          <div class="bg-panel border border-line rounded-2xl p-6">
            <h2 class="text-[13px] font-bold tracking-widest uppercase text-muted mb-3.5">
              {{ m.sym }} · Welcher Kurs entspricht welchem Risk?</h2>
            <table class="w-full font-mono text-[12.5px]">
              <thead><tr class="text-left text-muted">
                <th class="font-medium py-1.5 px-2 border-b border-line">Risk</th>
                <th class="font-medium py-1.5 px-2 border-b border-line text-right">entspricht heute etwa</th>
                <th class="font-medium py-1.5 px-2 border-b border-line text-right">vom aktuellen Kurs</th>
              </tr></thead>
              <tbody>
                @for (row of levels; track row.r) {
                  <tr [class.text-lo]="isNow(m.current.value, row.r)">
                    <td class="py-1.5 px-2 border-b border-panel2">{{ row.r.toFixed(2) }}{{ isNow(m.current.value, row.r) ? ' ◂ aktuell' : '' }}</td>
                    <td class="py-1.5 px-2 border-b border-panel2 text-right">{{ fmt(row.price) }} $</td>
                    <td class="py-1.5 px-2 border-b border-panel2 text-right">{{ fmt(100 * (row.price / m.current.price - 1), 1) }} %</td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="font-mono text-[11.5px] text-faint mt-2">Lesehilfe: Fällt der Kurs auf das Niveau in der Mitte,
              erreicht die Risk-Metrik den Wert links. Die Niveaus verschieben sich langsam mit dem gleitenden Durchschnitt.</p>
          </div>
        }
      }
    </div>
  `,
})
export class CryptoComponent {
  protected data = inject(MarketDataService);
  protected readonly fmt = fmt;

  protected readonly cryptoMetrics = computed(() =>
    this.data.metrics().filter(m => m.assetClass === 'crypto'));

  protected isNow(cur: number, r: number): boolean { return Math.abs(r - cur) <= 0.025; }

  protected readonly bear = computed<BearVm | null>(() => {
    const b = this.data.bear();
    if (!b) return null;
    const s = b.stats;
    const p = s.projected;
    return {
      chips: [
        { k: `2017/18 an Tag ${b.todayDay}`, v: Math.round(s.at18 * 100) + ' %', sub: 'des ATH' },
        { k: `2025/26 heute (Tag ${b.todayDay})`, v: Math.round(s.atNow * 100) + ' %', sub: 'des ATH', color: '#E8963C' },
        { k: 'Boden 2018', v: 'Tag ' + s.bottomDay, sub: `${Math.round(s.bottomPct * 100)} % · ${s.bottomDate}` },
        { k: 'Auf heute projiziert', v: `${p.slice(8, 10)}.${p.slice(5, 7)}.${p.slice(0, 4)}`, sub: 'möglicher Boden', color: '#F2B33D' },
      ],
      charts: b.cycles.map((cy, i) => ({
        name: cy.name, hex: cy.hex,
        ath: `ATH ${fmt(cy.peak)} $ am ${cy.peakDate}`,
        ...bearChartSvg(cy, 'bg' + i, b.maxDays, b.todayDay),
      })),
    };
  });
}
