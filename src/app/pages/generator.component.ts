import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, min } from '@angular/forms/signals';
import {
  AllocationRow, ASSET_UNIVERSE, dcaPlan, PROFILES, rebalance, signalTiltStrategy,
} from '../../../metrics-core/allocation';
import { fmt, MarketDataService } from '../core/market-data.service';

type Mode = 'dca' | 'rebalance';

@Component({
  selector: 'app-generator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField],
  template: `
    <div class="bg-panel border border-mid/50 rounded-2xl px-6 py-4 mb-4">
      <p class="text-[13px] text-muted leading-relaxed">
        <b class="text-mid">⚠ Simulation, keine Anlageberatung.</b> Dieses Werkzeug rechnet ein festes Regelwerk
        auf die aktuellen Dashboard-Signale — es kennt weder deine Gesamtsituation noch Steuern, Gebühren oder
        deine Risikotragfähigkeit. Die Ausgabe ist ein Rechenmodell zum Nachdenken, keine Empfehlung.
        Entscheidungen triffst und verantwortest du selbst.
      </p>
    </div>

    <!-- Eingaben -->
    <div class="bg-panel border border-line rounded-2xl p-6 mb-4">
      <div class="flex gap-2 flex-wrap mb-5">
        @for (m of modes; track m.id) {
          <button type="button" (click)="mode.set(m.id)"
            class="font-mono text-[12.5px] px-4 py-2 rounded-[9px] border"
            [class.bg-panel2]="mode() !== m.id" [class.border-line]="mode() !== m.id" [class.text-muted]="mode() !== m.id"
            [class.bg-lo]="mode() === m.id" [class.border-lo]="mode() === m.id" [class.text-ink]="mode() === m.id"
            [class.font-bold]="mode() === m.id">{{ m.label }}</button>
        }
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p class="font-mono text-[10.5px] tracking-wide uppercase text-faint mb-2">Risikoprofil</p>
          <div class="flex gap-2 flex-wrap">
            @for (p of profiles; track p.id) {
              <button type="button" (click)="profileId.set(p.id)"
                class="font-mono text-[12.5px] px-4 py-2 rounded-[9px] border"
                [class.bg-panel2]="profileId() !== p.id" [class.border-line]="profileId() !== p.id" [class.text-muted]="profileId() !== p.id"
                [class.border-lo]="profileId() === p.id" [class.text-lo]="profileId() === p.id">{{ p.label }}</button>
            }
          </div>
          <p class="font-mono text-[10.5px] tracking-wide uppercase text-faint mt-5 mb-2">
            Krypto-Obergrenze: <span class="text-fg">{{ maxCrypto() }} %</span></p>
          <input type="range" min="0" max="60" step="5" [value]="maxCrypto()"
            (input)="maxCrypto.set(+$any($event.target).value)" class="w-full accent-[#22C6B8]"
            aria-label="Maximaler Krypto-Anteil in Prozent">
          <p class="font-mono text-[10.5px] tracking-wide uppercase text-faint mt-5 mb-2">Assets im Universum</p>
          <div class="flex gap-1.5 flex-wrap">
            @for (a of toggleableAssets; track a.id) {
              <button type="button" (click)="toggleAsset(a.id)"
                class="font-mono text-[11.5px] px-2.5 py-1 rounded-lg border"
                [class.border-line]="!isActive(a.id)" [class.text-faint]="!isActive(a.id)" [class.line-through]="!isActive(a.id)"
                [class.text-fg]="isActive(a.id)" [style.border-color]="isActive(a.id) ? a.hex : null">{{ a.label }}</button>
            }
          </div>
        </div>

        <div>
          @if (mode() === 'dca') {
            <p class="font-mono text-[10.5px] tracking-wide uppercase text-faint mb-2">Monatliche Sparrate (€)</p>
            <input type="number" [formField]="f.monthly"
              class="w-full max-w-[200px] bg-panel2 border border-line rounded-[9px] px-4 py-2.5 font-mono text-[14px] text-fg focus:border-lo focus:outline-none"
              aria-label="Monatliche Sparrate in Euro">
          } @else {
            <p class="font-mono text-[10.5px] tracking-wide uppercase text-faint mb-2">Aktuelle Positionen (€, grob reicht)</p>
            <div class="grid grid-cols-2 gap-2.5">
              @for (a of activeAssetsWithCash(); track a.id) {
                <label class="block">
                  <span class="font-mono text-[11px] text-muted">
                    <span class="inline-block w-2 h-2 rounded-full mr-1" [style.background]="a.hex"></span>{{ a.label }}</span>
                  <input type="number" [formField]="posField(a.id)" placeholder="0"
                    class="w-full mt-1 bg-panel2 border border-line rounded-[9px] px-3 py-2 font-mono text-[13px] text-fg focus:border-lo focus:outline-none"
                    [attr.aria-label]="a.label + ' Position in Euro'">
                </label>
              }
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Zielgewichte -->
    @if (rows(); as R) {
      <div class="bg-panel border border-line rounded-2xl p-6 mb-4">
        <h2 class="text-[13px] font-bold tracking-widest uppercase text-muted mb-4">
          Zielgewichte · {{ profile().label }} · Strategie „{{ strategyLabel }}"</h2>
        @for (r of R; track r.asset.id) {
          <div class="mb-3.5">
            <div class="flex justify-between items-baseline gap-2 flex-wrap">
              <span class="font-mono text-[12.5px] text-fg">
                <span class="inline-block w-2 h-2 rounded-full mr-1.5" [style.background]="r.asset.hex"></span>
                {{ r.asset.label }}</span>
              <span class="font-mono text-[12.5px]">
                <span class="text-faint">Basis {{ (100 * r.baseWeight).toFixed(1) }} %</span>
                <span class="text-fg font-semibold ml-2">→ {{ (100 * r.targetWeight).toFixed(1) }} %</span>
                <span class="ml-2" [class.text-lo]="r.signal > 0.3" [class.text-hi]="r.signal < -0.3" [class.text-faint]="r.signal >= -0.3 && r.signal <= 0.3">
                  Signal {{ r.signal > 0 ? '+' : '' }}{{ r.signal.toFixed(2) }}</span>
              </span>
            </div>
            <div class="h-[7px] bg-panel2 rounded mt-1.5 relative overflow-hidden">
              <div class="absolute inset-y-0 left-0 opacity-35 rounded" [style.width.%]="100 * r.baseWeight" [style.background]="r.asset.hex"></div>
              <div class="absolute inset-y-0 left-0 rounded" [style.width.%]="100 * r.targetWeight" [style.background]="r.asset.hex" style="opacity:.85"></div>
            </div>
            <p class="font-mono text-[11px] text-faint mt-1">{{ r.note }}</p>
          </div>
        }
      </div>

      @if (mode() === 'dca') {
        <div class="bg-panel border border-line rounded-2xl p-6">
          <h2 class="text-[13px] font-bold tracking-widest uppercase text-muted mb-3.5">
            Sparplan · {{ fmt(monthlyValue()) }} € pro Monat</h2>
          <table class="w-full font-mono text-[12.5px] max-w-md">
            <tbody>
              @for (p of plan(); track p.asset.id) {
                <tr>
                  <td class="py-1.5 border-b border-panel2">
                    <span class="inline-block w-2 h-2 rounded-full mr-1.5" [style.background]="p.asset.hex"></span>{{ p.asset.label }}</td>
                  <td class="py-1.5 border-b border-panel2 text-right text-fg font-semibold">{{ fmt(p.amount) }} €</td>
                  <td class="py-1.5 border-b border-panel2 text-right text-faint">{{ (100 * p.weight).toFixed(1) }} %</td>
                </tr>
              }
            </tbody>
          </table>
          <p class="font-mono text-[11.5px] text-faint mt-3">Die Aufteilung folgt den Zielgewichten oben und
            verschiebt sich automatisch mit den Signalen: Wird ein Asset historisch günstig, wächst sein Anteil
            an der Rate — wird es heiß, schrumpft er.</p>
        </div>
      } @else {
        <div class="bg-panel border border-line rounded-2xl p-6">
          <h2 class="text-[13px] font-bold tracking-widest uppercase text-muted mb-3.5">
            Rebalancing-Vorschlag @if (reb().total > 0) { · Depotwert {{ fmt(reb().total) }} € }</h2>
          @if (reb().total <= 0) {
            <p class="text-muted text-[13.5px]">Trage links deine aktuellen Positionen ein — auch grobe Beträge reichen.</p>
          } @else if (reb().trades.length === 0) {
            <p class="text-muted text-[13.5px]">✓ Alle Abweichungen liegen innerhalb des 2-Prozentpunkte-Bandes —
              nach diesem Regelwerk gibt es nichts zu tun. Umschichten würde nur Gebühren kosten.</p>
          } @else {
            <table class="w-full font-mono text-[12.5px]">
              <tbody>
                @for (t of reb().trades; track t.asset.id) {
                  <tr>
                    <td class="py-1.5 border-b border-panel2 font-bold"
                        [class.text-hi]="t.action === 'verkaufen'" [class.text-lo]="t.action === 'kaufen'">{{ t.action }}</td>
                    <td class="py-1.5 border-b border-panel2">
                      <span class="inline-block w-2 h-2 rounded-full mr-1.5" [style.background]="t.asset.hex"></span>{{ t.asset.label }}</td>
                    <td class="py-1.5 border-b border-panel2 text-right text-fg font-semibold">{{ fmt(t.amount) }} €</td>
                    <td class="py-1.5 border-b border-panel2 text-right text-faint">{{ (100 * t.fromWeight).toFixed(1) }} % → {{ (100 * t.toWeight).toFixed(1) }} %</td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="font-mono text-[11.5px] text-faint mt-3">Verkäufe zuerst — sie liefern die Liquidität für die
              Käufe. Abweichungen unter 2 Prozentpunkten werden bewusst ignoriert (Handelskosten). Steuern und
              Gebühren sind nicht berücksichtigt.</p>
          }
        </div>
      }
    }
  `,
})
export class GeneratorComponent {
  private data = inject(MarketDataService);
  protected readonly fmt = fmt;
  protected readonly strategyLabel = signalTiltStrategy.label;

  protected readonly modes: { id: Mode; label: string }[] = [
    { id: 'dca', label: 'Sparplan (monatliche Rate)' },
    { id: 'rebalance', label: 'Bestehendes Depot rebalancen' },
  ];
  protected readonly profiles = PROFILES;
  protected readonly toggleableAssets = ASSET_UNIVERSE.filter(a => a.cls !== 'cash');

  protected readonly mode = signal<Mode>('dca');
  protected readonly profileId = signal('ausgewogen');
  protected readonly maxCrypto = signal(25);
  protected readonly active = signal<Set<string>>(new Set(this.toggleableAssets.map(a => a.id)));

  private readonly model = signal({
    monthly: 500,
    posBtc: 0, posEth: 0, posGold: 0, posSilver: 0, posPall: 0, posNdx: 0, posAi: 0, posCash: 0,
  });
  protected readonly f = form(this.model, p => {
    min(p.monthly, 1);
    min(p.posBtc, 0); min(p.posEth, 0); min(p.posGold, 0); min(p.posSilver, 0);
    min(p.posPall, 0); min(p.posNdx, 0); min(p.posAi, 0); min(p.posCash, 0);
  });

  private readonly posKey: Record<string, keyof ReturnType<typeof this.model>> = {
    btc: 'posBtc', eth: 'posEth', gold: 'posGold', silver: 'posSilver',
    pall: 'posPall', ndx: 'posNdx', ai: 'posAi', cash: 'posCash',
  };
  protected posField(assetId: string) { return this.f[this.posKey[assetId]]; }

  protected isActive(id: string): boolean { return this.active().has(id); }
  protected toggleAsset(id: string): void {
    const next = new Set(this.active());
    if (next.has(id)) { if (next.size > 1) next.delete(id); } else { next.add(id); }
    this.active.set(next);
  }

  protected readonly profile = computed(() =>
    PROFILES.find(p => p.id === this.profileId()) ?? PROFILES[1]);
  protected readonly activeAssetsWithCash = computed(() =>
    ASSET_UNIVERSE.filter(a => a.cls === 'cash' || this.active().has(a.id)));

  protected readonly rows = computed<AllocationRow[] | null>(() => {
    if (!this.data.metrics().length) return null;
    return signalTiltStrategy.allocate({
      profile: this.profile(),
      activeAssetIds: [...this.active()],
      maxCryptoWeight: this.maxCrypto() / 100,
      metrics: this.data.metrics(),
    });
  });

  protected readonly monthlyValue = computed(() => Math.max(0, this.model().monthly || 0));
  protected readonly plan = computed(() => dcaPlan(this.rows() ?? [], this.monthlyValue()));
  protected readonly reb = computed(() => {
    const m = this.model();
    return rebalance(this.rows() ?? [], {
      btc: m.posBtc || 0, eth: m.posEth || 0, gold: m.posGold || 0, silver: m.posSilver || 0,
      pall: m.posPall || 0, ndx: m.posNdx || 0, ai: m.posAi || 0, cash: m.posCash || 0,
    });
  });
}
