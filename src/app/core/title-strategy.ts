import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const SITE = 'Macro Risk Dashboard';
const ORIGIN = 'https://chipper-cucurucho-5d0a49.netlify.app';
const HOME_TITLE = `${SITE} · Krypto · Metalle · KI · Währungen`;
const HOME_DESC = 'Wie günstig oder teuer stehen Bitcoin, Gold, der Nasdaq und die großen Währungen — '
  + 'gemessen an ihrer eigenen Geschichte? Täglich neu berechnete Perzentile statt Bauchgefühl.';

/** Setzt Titel, Meta-Beschreibung und Canonical pro Route. Ohne das teilen sich alle
 *  Seiten einer SPA denselben Eintrag in Tab, Verlauf, Suchergebnis und Link-Vorschau.
 *  Bewusst NICHT in main.ts: eine exportierte Klasse dort zwingt den Builder, das
 *  Hauptbundle in einen Stub plus Lazy-Chunk zu zerlegen — ein Roundtrip extra. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    const title = routeTitle ? `${routeTitle} · ${SITE}` : HOME_TITLE;
    this.title.setTitle(title);

    // Beschreibung der tiefsten Route mit eigenem `data.description` gewinnt.
    let route = snapshot.root;
    let desc: string | undefined;
    while (route.firstChild) {
      route = route.firstChild;
      desc = (route.data['description'] as string | undefined) ?? desc;
    }
    const description = desc ?? HOME_DESC;

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    const url = ORIGIN + (snapshot.url === '/' ? '/' : snapshot.url.split('?')[0]);
    this.meta.updateTag({ property: 'og:url', content: url });
    this.setCanonical(url);
  }

  private setCanonical(url: string): void {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }
}
