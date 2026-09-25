import { ChangeDetectionStrategy, Component, Directive, ElementRef, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PALETTE } from '../../../metrics-core/palette';
import { Zone } from '../../../metrics-core/types';
import { TipData } from '../core/charts';
import { fmt } from '../core/market-data.service';
import { RevealDirective } from './reveal.directive';

/* ===== Tooltip: Wert am Mauszeiger (Fadenkreuz) ===== */
const NS = 'http://www.w3.org/2000/svg';

/** Ein einziges Tooltip-Element für alle Charts, am Body verankert, damit es nie von einer
 *  Karte abgeschnitten wird. */
function tipEl(): HTMLElement {
  let el = document.getElementById('charttip');
  if (!el) { el = document.createElement('div'); el.id = 'charttip'; document.body.appendChild(el); }
  return el;
}
const fmtTip = (v: number): string => v >= 1000 ? fmt(v, 0) : v >= 100 ? fmt(v, 1) : fmt(v, 2);

/** Fadenkreuz und Tooltip über einem SVG-Chart. Das SVG kommt als fertiger String
 *  (`innerHTML`), deshalb werden Linie und Punkt hier direkt ins SVG gesetzt — Angular
 *  kennt dessen Inhalt nicht. Die Umrechnung von Mausposition auf Datenpunkt nutzt den
 *  Rahmen, mit dem der Chart gezeichnet wurde (`tip.frame`). */
@Directive({
  selector: '[appChartTip]',
  host: { '(pointermove)': 'onMove($event)', '(pointerleave)': 'onLeave()' },
})
export class ChartTipDirective {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  tipData = input.required<TipData>({ alias: 'appChartTip' });

  onMove(e: PointerEvent): void {
    const svg: SVGSVGElement | null = this.host.nativeElement.querySelector('svg');
    if (!svg) return;
    const d = this.tipData();
    const f = d.frame;
    const n = d.v.length;
    const rect = svg.getBoundingClientRect();
    // Breite, die die Punkte belegen — beim Bärenmarkt-Chart endet der Verlauf vor dem Rand.
    const plotW = (f.w - f.l - f.r) * (d.s ?? 1);
    const xv = (e.clientX - rect.left) / rect.width * f.w;
    const i = Math.max(0, Math.min(n - 1, Math.round((xv - f.l) / plotW * (n - 1))));
    const xi = f.l + plotW * i / (n - 1);
    const yi = f.t + (f.h - f.t - f.b) * (1 - d.v[i]);

    let cl: SVGLineElement | null = svg.querySelector('.cross');
    let dot: SVGCircleElement | null = svg.querySelector('.crossdot');
    if (!cl || !dot) {
      cl = document.createElementNS(NS, 'line'); cl.setAttribute('class', 'cross');
      cl.setAttribute('stroke', PALETTE.fg); cl.setAttribute('stroke-width', '1');
      cl.setAttribute('stroke-dasharray', '2 3'); svg.appendChild(cl);
      dot = document.createElementNS(NS, 'circle'); dot.setAttribute('class', 'crossdot');
      dot.setAttribute('r', '3.5'); dot.setAttribute('fill', PALETTE.fg); svg.appendChild(dot);
    }
    cl.setAttribute('y1', String(f.t)); cl.setAttribute('y2', String(f.h - f.b));
    cl.setAttribute('x1', String(xi)); cl.setAttribute('x2', String(xi)); cl.setAttribute('opacity', '.6');
    dot.setAttribute('cx', String(xi)); dot.setAttribute('cy', String(yi)); dot.setAttribute('opacity', '1');

    const pTxt = d.p && d.p[i] != null ? `${fmtTip(d.p[i])}${d.u ? ' ' + d.u : ''}` : '';
    const tip = tipEl();
    if (d.f === 'none') {
      // Preis-Chart: v trägt nur die Position auf der eigenen Skala, angezeigt wird p.
      tip.textContent = `${d.m[i]} · ${d.l} ${pTxt}`;
    } else {
      const vTxt = d.f === 'pct' ? Math.round(d.v[i] * 100) + ' %' : d.v[i].toFixed(2);
      tip.textContent = `${d.m[i]} · ${d.l} ${vTxt}${pTxt ? ' · ' + pTxt : ''}`;
    }
    tip.style.display = 'block';
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 10, e.clientX + 14) + 'px';
    tip.style.top = Math.max(6, e.clientY - 36) + 'px';
  }

  onLeave(): void {
    tipEl().style.display = 'none';
    this.host.nativeElement.querySelectorAll('.cross, .crossdot').forEach((el: Element) => el.setAttribute('opacity', '0'));
  }
}

/* ===== SVG-Chart-Wrapper =====
 * Die Einzeichnung startet, sobald der Chart in den Sichtbereich kommt — das übernimmt
 * `RevealDirective` als Host-Direktive, dieselbe, die auf der Startseite als `appReveal`
 * sitzt. Eine zweite, eigene Implementierung gibt es nicht mehr. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-chart',
  imports: [ChartTipDirective],
  hostDirectives: [RevealDirective],
  template: `
    <div class="spark mt-2.5" [appChartTip]="tip()" [innerHTML]="safeSvg()"></div>
  `,
})
export class ChartComponent {
  private sanitizer = inject(DomSanitizer);
  svg = input.required<string>();
  tip = input.required<TipData>();

  /** Angulars Standard-Bereinigung entfernt SVG vollständig, deshalb der Bypass. Vertretbar,
   *  weil der String ausschließlich in `core/charts.ts` aus Zahlen zusammengesetzt wird. */
  protected readonly safeSvg = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.svg()));
}

/* ===== Farbband-Rail ===== */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rail',
  hostDirectives: [RevealDirective],
  template: `
    <div class="relative h-[58px] mx-0.5">
      <div class="absolute left-0 right-0 top-[20px] h-[11px] rounded-md"
           [class.bg-skala]="!neutral()" [class.bg-skala-neutral]="neutral()"></div>
      @for (t of ticks; track t) {
        <div class="absolute top-[36px] font-mono text-[10px] text-faint -translate-x-1/2"
             [style.left.%]="t * 100">{{ t.toFixed(2) }}</div>
      }
      @for (gh of ghosts(); track gh.t) {
        <div class="absolute top-[16px] w-0.5 h-[19px] bg-muted opacity-45" [style.left.%]="gh.r * 100">
          <em class="absolute -top-[15px] left-1/2 -translate-x-1/2 not-italic font-mono text-[9.5px] text-muted whitespace-nowrap">{{ gh.t }}</em>
        </div>
      }
      <div class="rail-marker absolute top-[9px] w-[3px] h-[33px] bg-fg rounded-sm transition-[left] duration-700"
           style="box-shadow:0 0 10px rgba(255,255,255,.35)"
           [style.left.%]="markerLeft()"></div>
    </div>
    @if (zones().length || hotAbove() !== null) {
      <div class="flex gap-2 flex-wrap mt-3 rail-chips">
        @for (z of zones(); track z.label) {
          <div class="font-mono text-[11px] px-2.5 py-1 rounded-lg border"
               [class.border-lo]="value() < z.below" [class.text-lo]="value() < z.below"
               [class.border-line]="value() >= z.below" [class.text-muted]="value() >= z.below">
            {{ z.label }} {{ z.text }}
          </div>
        }
        @let hot = hotAbove();
        @if (hot !== null) {
          <div class="font-mono text-[11px] px-2.5 py-1 rounded-lg border"
               [class.border-hi]="value() > hot" [class.text-hi]="value() > hot"
               [class.border-line]="value() <= hot" [class.text-muted]="value() <= hot">
            Überhitzt &gt; {{ hot.toFixed(2) }}
          </div>
        }
      </div>
    }
  `,
})
export class RailComponent {
  value = input.required<number>();
  ghosts = input<{ r: number; t: string }[]>([]);
  zones = input<Zone[]>([]);
  hotAbove = input<number | null>(null);
  /** Band ohne Wertungsfarben — für Metriken ohne Zonen, bei denen es kein günstig oder
   *  teuer gibt (Währungen). Ein türkis-rotes Band würde dort etwas behaupten. */
  neutral = input(false);
  protected readonly ticks = [0, 0.25, 0.5, 0.75, 1];
  /** Knapp vor dem rechten Rand anhalten, damit der Marker bei 1,0 nicht übersteht. */
  protected readonly markerLeft = computed(() => Math.min(99.7, this.value() * 100));
}

/* ===== Ladeplatzhalter =====
 * Hält die Geometrie einer Metrik-Karte, solange der erste Snapshot unterwegs ist. Ohne ihn
 * greift auf den Seiten der @empty-Zweig und die Seite behauptet währenddessen, es lägen
 * keine Daten vor — und springt beim Eintreffen in der Höhe.
 *
 * Nur beim Erstaufruf: Beim Neuladen liegen bereits Werte vor, die durch Balken zu ersetzen
 * wäre ein Rückschritt. Dort meldet der Statusbalken im Kopf den Ladevorgang. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-metric-skeleton',
  template: `
    @for (i of rows(); track i) {
      <div class="card p-6 mb-4" aria-hidden="true">
        <!-- Kopfzeile: Titel links, Statistikzeile rechts -->
        <div class="flex justify-between items-baseline gap-2.5 mb-3">
          <div class="sk h-[15px] w-[170px]"></div>
          <div class="sk h-[12px] w-[210px] max-w-[45%]"></div>
        </div>
        <!-- großer Wert -->
        <div class="sk h-[34px] w-[104px] my-1"></div>
        <!-- Deutungstext -->
        <div class="sk h-[11px] w-full mt-3"></div>
        <div class="sk h-[11px] w-3/5 mt-2"></div>
        <!-- Farbband und Zonen-Chips -->
        <div class="sk h-[11px] w-full rounded-md mt-7"></div>
        <div class="flex gap-2 mt-5">
          <div class="sk h-[25px] w-[118px] rounded-lg"></div>
          <div class="sk h-[25px] w-[132px] rounded-lg"></div>
        </div>
        <!-- Chart: exakt das Seitenverhältnis der viewBox, damit die Höhe mitwächst -->
        <div class="sk w-full rounded-lg mt-4 aspect-[460/118]"></div>
      </div>
    }
  `,
})
export class MetricSkeletonComponent {
  /** Wie viele Karten die Seite üblicherweise zeigt — damit die Höhe grob stimmt. */
  count = input(3);
  protected readonly rows = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
