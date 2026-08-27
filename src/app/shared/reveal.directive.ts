import { DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * Setzt `in-view`, sobald das Element zum ersten Mal in den Sichtbereich kommt, und
 * `reveal-pending` sofort davor. Eintritts-Animationen hängen an diesem Paar: Der
 * pausierte Startzustand gilt ab dem ersten gezeichneten Bild, der Beobachter lässt
 * ihn nur noch anlaufen.
 *
 * Ohne IntersectionObserver wird nichts gesetzt — dann fehlt die Animation, aber der
 * Inhalt ist vollständig da. Die Reihenfolge im Konstruktor ist deshalb wichtig:
 * `pending` erst, nachdem der Beobachter nachweislich steht.
 */
@Directive({
  selector: '[appReveal]',
  host: {
    '[class.reveal-pending]': 'pending()',
    '[class.in-view]': 'shown()',
  },
})
export class RevealDirective {
  protected readonly pending = signal(false);
  protected readonly shown = signal(false);

  constructor() {
    if (typeof IntersectionObserver !== 'function') return;
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        this.shown.set(true);
        io.disconnect();
      }
    }, { rootMargin: '0px 0px -60px 0px' });
    this.pending.set(true);
    io.observe(el);
    inject(DestroyRef).onDestroy(() => io.disconnect());
  }
}
