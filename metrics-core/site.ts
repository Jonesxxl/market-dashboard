/** metrics-core · Seiten-Metadaten. Gelesen von den Angular-Routen (`src/app/app.ts`), der
 *  TitleStrategy und dem Generator der statischen Seiten (`scripts/build-static-pages.ts`).
 *
 *  Vorher standen Titel, Beschreibungen und die Domain doppelt — einmal für den Browser,
 *  einmal für die Crawler —, und die Texte waren bereits auseinandergelaufen: Ein KI-Crawler
 *  las für /krypto eine andere Beschreibung als der Browser nach dem Start. */

export const ORIGIN = 'https://chipper-cucurucho-5d0a49.netlify.app';
export const SITE_NAME = 'Macro Risk Dashboard';

export const HOME = {
  title: `${SITE_NAME} · Krypto · Metalle · KI · Währungen`,
  description: 'Wie günstig oder teuer stehen Bitcoin, Gold, der Nasdaq und die großen Währungen — '
    + 'gemessen an ihrer eigenen Geschichte? Täglich neu berechnete Perzentile statt Bauchgefühl.',
};

export type PagePath =
  'krypto' | 'metalle' | 'nasdaq-ki' | 'waehrungen' | 'generator' | 'impressum' | 'datenschutz';

export interface PageMeta { title: string; description: string; }

export const PAGES: Record<PagePath, PageMeta> = {
  krypto: {
    title: 'Krypto — Risk-Metrik für Bitcoin und Ethereum',
    description: 'Zyklus-Risk für Bitcoin und Ethereum: 0 entspricht dem Niveau historischer Böden, 1 dem historischer Tops. Dazu Kursniveaus je Risk-Zone, der MVRV-Z-Score, der Digital-Asset-Basket und der Vergleich der Bärenmärkte 2017/18 und 2025/26.',
  },
  metalle: {
    title: 'Edelmetalle — Gold, Silber und Palladium',
    description: 'Heat-Perzentile für Gold, Silber und Palladium: wie weit der Kurs von seinem 200-Tage-Durchschnitt abweicht und wie selten das historisch war. Dazu Gold/Silber- und Palladium/Gold-Verhältnis.',
  },
  'nasdaq-ki': {
    title: 'Nasdaq und KI — Blasen-Score',
    description: 'Der KI-Blasen-Score bündelt fünf Messgrößen: Nasdaq-Trend, Trend des KI-Baskets, dessen Vorsprung vor dem S&P 500, die Marktkonzentration (SPY/RSP) und den Kredit-Risikoappetit (HYG/LQD).',
  },
  waehrungen: {
    title: 'Währungen — Dollar-Index und Paare',
    description: 'Dollar-Index, USD/EUR, USD/CHF, USD/CNY, USD/GHS und das Kreuzpaar CHF/EUR — je Karte der Heat-Wert und der tatsächliche Kursverlauf. Bei den Dollar-Paaren bedeutet eine steigende Kurve immer einen stärkeren Dollar.',
  },
  generator: {
    title: 'Sparplan- und Rebalancing-Generator',
    description: 'Leitet aus den aktuellen Signalen eine Gewichtung für Sparrate oder Depot ab. Die Berechnung läuft vollständig im Browser — eingegebene Beträge werden nicht übertragen und nicht gespeichert.',
  },
  impressum: {
    title: 'Impressum',
    description: 'Anbieterkennzeichnung nach § 5 DDG sowie Hinweise zu Haftung und Inhalt des Macro Risk Dashboards.',
  },
  datenschutz: {
    title: 'Datenschutz',
    description: 'Diese Seite setzt keine Cookies, nutzt keinen LocalStorage und enthält keine Formulare. Welche Daten beim Aufruf trotzdem verarbeitet werden, steht hier.',
  },
};
