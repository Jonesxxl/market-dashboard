import { ChangeDetectionStrategy, Component, Directive, ElementRef, HostListener, computed, inject, input,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TipData } from '../core/charts';
import { fmt } from '../core/market-data.service';

/* ===== Tooltip: Wert am Mauszeiger (Fadenkreuz) ===== */
const SPW = 460, SPL = 34, SPR = 14, SPT = 10, SPB = 20, SPH = 118;
const NS = 'http://www.w3.org/2000/svg';

function tipEl(): HTMLElement {
  let el = document.getElementById('charttip');
  if (!el) { el = document.createElement('div'); el.id = 'charttip'; document.body.appendChild(el); }
  return el;
}
const fmtTip = (v: number): string => v >= 1000 ? fmt(v, 0) : v >= 100 ? fmt(v, 1) : fmt(v, 2);

@Directive({ selector: '[appChartTip]', standalone: true })
export class ChartTipDirective {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  tipData = input.required<TipData>({ alias: 'appChartTip' });

  @HostListener('pointermove', ['$event'])
  onMove(e: PointerEvent): void {
    const svg: SVGSVGElement | null = this.host.nativeElement.querySelector('svg');
    if (!svg) return;
    const d = this.tipData();
    const rect = svg.getBoundingClientRect();
    const n = d.v.length;
    const span = d.s ?? 1;
    const xv = (e.clientX - rect.left) / rect.width * SPW;
    let i = Math.round((xv - SPL) / ((SPW - SPL - SPR) * span) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    const xi = SPL + (SPW - SPL - SPR) * span * i / (n - 1);
    const HH = d.hh ?? SPH, HT = d.ht ?? SPT, HB = d.hb ?? SPB;
    const yi = HT + (HH - HT - HB) * (1 - d.v[i]);
    let cl: SVGLineElement | null = svg.querySelector('.cross');
    let dot: SVGCircleElement | null = svg.querySelector('.crossdot');
    if (!cl) {
      cl = document.createElementNS(NS, 'line'); cl.setAttribute('class', 'cross');
      cl.setAttribute('stroke', '#E8EEF7'); cl.setAttribute('stroke-width', '1');
      cl.setAttribute('stroke-dasharray', '2 3'); svg.appendChild(cl);
      dot = document.createElementNS(NS, 'circle'); dot.setAttribute('class', 'crossdot');
      dot.setAttribute('r', '3.5'); dot.setAttribute('fill', '#E8EEF7'); svg.appendChild(dot);
    }
    cl.setAttribute('y1', String(HT)); cl.setAttribute('y2', String(HH - HB));
    cl.setAttribute('x1', String(xi)); cl.setAttribute('x2', String(xi)); cl.setAttribute('opacity', '.6');
    dot!.setAttribute('cx', String(xi)); dot!.setAttribute('cy', String(yi)); dot!.setAttribute('opacity', '1');
    const extra = d.p && d.p[i] != null ? ` · ${fmtTip(d.p[i])}${d.u ? ' ' + d.u : ''}` : '';
    const vTxt = d.f === 'pct' ? Math.round(d.v[i] * 100) + ' %' : d.v[i].toFixed(2);
    const tip = tipEl();
    tip.textContent = `${d.m[i]} · ${d.l} ${vTxt}${extra}`;
    tip.style.display = 'block';
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 10, e.clientX + 14) + 'px';
    tip.style.top = Math.max(6, e.clientY - 36) + 'px';
  }

  @HostListener('pointerleave')
  onLeave(): void {
    tipEl().style.display = 'none';
    this.host.nativeElement.querySelectorAll('.cross, .crossdot').forEach((el: Element) => el.setAttribute('opacity', '0'));
  }
}

/* ===== SVG-Chart-Wrapper ===== */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-chart',
  imports: [ChartTipDirective],
  template: `
    <div class="spark mt-2.5" [appChartTip]="tip()" [innerHTML]="safeSvg()"></div>
  `,
})
export class ChartComponent {
  private sanitizer = inject(DomSanitizer);
  svg = input.required<string>();
  tip = input.required<TipData>();
  protected readonly safeSvg = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.svg()));
}

/* ===== Farbband-Rail ===== */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rail',
  template: `
    <div class="relative h-[58px] mx-0.5">
      <div class="absolute left-0 right-0 top-[20px] h-[11px] rounded-md"
           style="background:linear-gradient(90deg,#22C6B8 0%,#22C6B8 15%,#F2B33D 50%,#F0533F 88%)"></div>
      @for (t of ticks; track t) {
        <div class="absolute top-[36px] font-mono text-[10px] text-faint -translate-x-1/2"
             [style.left.%]="t * 100">{{ t.toFixed(2) }}</div>
      }
      @for (gh of ghosts(); track gh.t) {
        <div class="absolute top-[16px] w-0.5 h-[19px] bg-muted opacity-45" [style.left.%]="gh.r * 100">
          <em class="absolute -top-[15px] left-1/2 -translate-x-1/2 not-italic font-mono text-[9.5px] text-muted whitespace-nowrap">{{ gh.t }}</em>
        </div>
      }
      <div class="absolute top-[9px] w-[3px] h-[33px] bg-fg rounded-sm transition-[left] duration-700"
           style="box-shadow:0 0 10px rgba(255,255,255,.35)"
           [style.left.%]="Math.min(99.7, value() * 100)"></div>
    </div>
    @if (zones().length || hotAbove() !== null) {
      <div class="flex gap-2 flex-wrap mt-3">
        @for (z of zones(); track z[0]) {
          <div class="font-mono text-[11px] px-2.5 py-1 rounded-lg border"
               [class.border-lo]="value() < z[2]" [class.text-lo]="value() < z[2]"
               [class.border-line]="value() >= z[2]" [class.text-muted]="value() >= z[2]">
            {{ z[0] }} {{ z[1] }}
          </div>
        }
        @if (hotAbove() !== null) {
          <div class="font-mono text-[11px] px-2.5 py-1 rounded-lg border"
               [class.border-hi]="value() > hotAbove()!" [class.text-hi]="value() > hotAbove()!"
               [class.border-line]="value() <= hotAbove()!" [class.text-muted]="value() <= hotAbove()!">
            Überhitzt &gt; {{ hotAbove()!.toFixed(2) }}
          </div>
        }
      </div>
    }
  `,
})
export class RailComponent {
  value = input.required<number>();
  ghosts = input<{ r: number; t: string }[]>([]);
  zones = input<[string, string, number][]>([]);
  hotAbove = input<number | null>(null);
  protected readonly ticks = [0, 0.25, 0.5, 0.75, 1];
  protected readonly Math = Math;
}
