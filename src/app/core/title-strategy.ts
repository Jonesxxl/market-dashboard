import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const SITE = 'Macro Risk Dashboard';
const HOME_TITLE = `${SITE} · Krypto · Metalle · KI · Währungen`;

/** Hängt den Seitennamen an den Routentitel aus `routes`. Die Startroute trägt bewusst
 *  einen leeren Titel und bekommt dadurch den vollen Titel aus index.html.
 *  Bewusst NICHT in main.ts: eine exportierte Klasse dort zwingt den Builder, das
 *  Hauptbundle in einen Stub plus Lazy-Chunk zu zerlegen — ein Roundtrip extra. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    this.title.setTitle(routeTitle ? `${routeTitle} · ${SITE}` : HOME_TITLE);
  }
}
