# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Überblick

Macro Risk Dashboard — bewertet Krypto, Edelmetalle, Nasdaq/KI und Währungen danach, wie günstig oder teuer sie **relativ zu ihrer eigenen Historie** stehen. Angular-22-SPA auf Netlify, gefüttert von einem täglichen GitHub-Actions-Lauf.

**Projektsprache ist Deutsch.** UI-Texte, Code-Kommentare, Commit-Messages und vor allem die `interpret`-Strings der Metriken sind durchgehend deutsch und richten sich an Laien, nicht an Finanzprofis. Neue Texte in diesem Ton und dieser Sprache schreiben.

## Befehle

**Node 24 ist Pflicht** (`.nvmrc`, `engines`, `NODE_VERSION` in `netlify.toml`). Angular 22 verweigert unter v24.15.0 den Build — mit einer älteren Node-Version scheitert `npm run build` sofort.

```bash
npm ci                     # Abhängigkeiten (node_modules ist nicht eingecheckt)
npm start                  # Dev-Server auf http://localhost:4200
npm run build              # Produktionsbuild nach dist/macro-ng/browser
npm run typecheck          # Typen von scripts/ + metrics-core/ (läuft auch im Cron)
npm run snapshot           # Snapshot lokal bauen — schreibt public/snapshot.json!
netlify dev --dir dist/macro-ng/browser   # Gebautes Ergebnis mit netlify.toml-Headern servieren
gh workflow run snapshot.yml --ref main   # Täglichen Lauf manuell auslösen
```

**Tests:** `npm test` startet Karma, aber es existiert **keine einzige `.spec.ts`** — alle Schematics in `angular.json` haben `skipTests: true`. Einzelne Datei nach dem Anlegen: `ng test --include='**/name.spec.ts'`. Ein Linter ist nicht eingerichtet. Die einzige automatische Prüfung ist `npm run typecheck`.

`npm run snapshot` überschreibt `public/snapshot.json` und legt einen Archiveintrag an. Vor dem Ausführen bedenken, dass das ein Commit-relevanter Nebeneffekt ist. Zum gefahrlosen Testen den Builder in einem leeren Verzeichnis mit `public/` und `data/archive/` laufen lassen.

## Architektur

### Das Frontend rechnet nichts

Zentrale Entscheidung: Sämtliche Metrik-Berechnung passiert im täglichen Node-Lauf. Das Frontend lädt ausschließlich `/snapshot.json` und rendert es. `MarketDataService` hat genau einen `resource()`-Loader und keinerlei Marktlogik.

```
GitHub Action (cron 05:17 UTC + workflow_dispatch)
  └─ scripts/build-snapshot.ts  →  buildSnapshot(NODE_CTX)
       └─ schreibt public/snapshot.json + data/archive/<datum>.json
            └─ Commit als snapshot-bot  →  Webhook  →  Netlify-Build
                 └─ Angular lädt /snapshot.json
```

**Die Daten hängen bewusst nicht am Deploy.** `SNAPSHOT_REMOTE` in `src/app/core/market-data.service.ts` zeigt auf die Raw-URL des Repos; die mitgebaute `/snapshot.json` ist nur noch Fallback. Scheitert ein Netlify-Build, bleiben die Zahlen trotzdem aktuell. Wer die Raw-URL ändert, muss `connect-src` in der CSP (`netlify.toml`) mitziehen — sonst blockiert der Browser den Abruf und die Seite fällt still auf die Deploy-Kopie zurück.

### metrics-core/ — geteilter, plattformneutraler Kern

Läuft in Node **und** im Browser, deshalb keine Node-Imports darin. `FetchContext` abstrahiert nur die Basis-URLs (Node: direkte URLs; Browser wäre über Proxy-Pfade gedacht, ist aktuell aber nicht verdrahtet — es gibt keine Proxy-Config in `angular.json`).

| Datei | Rolle |
|---|---|
| `types.ts` | Alle geteilten Typen. `Snapshot` ist der Vertrag zwischen Cron und Frontend. |
| `math.ts` | Reine Funktionen, keine Abhängigkeiten. `computeHeat`, `computeRisk`, `percentileRank`. |
| `sources.ts` | Datenbeschaffung inkl. Fallbacks und Retries. |
| `metrics.ts` | **Die Registry.** Eine Metrik = ein Eintrag. |
| `snapshot.ts` | Baut den Snapshot, inkl. abgeleiteter Blöcke (Ratios, Bärenmarkt, KI-Blase). |
| `allocation.ts` | Regelwerk hinter der Generator-Seite. |

**Neue Metrik hinzufügen = ein Eintrag in `REGISTRY` in `metrics.ts`.** Snapshot-Builder, Frontend und Generator iterieren darüber und sehen sie automatisch. Eine `MetricDefinition` liefert `fetch`, `compute`, `interpret` und optional `extra`.

### Zwei Metrik-Arten, beide auf 0…1 normiert

- **`heat`** (Metalle, Aktien, FX, Baskets): historisches Perzentil von `ln(Preis / SMA200)`. `0.10` heißt: nur an 10 % aller Tage war das Asset günstiger zu seinem Trend.
- **`risk`** (BTC, ETH): min-max-normiertes `ln(Preis/SMA374) × Tagesindex^0.395`, 0 = Bodenniveau, 1 = Topniveau.

Die Normierungskonstanten in `RISK_CONSTANTS` (`math.ts`) sind **eingefroren** (v1, fixiert 2026-07-19). Das ist Absicht: Sonst würde ein neues Extrem die gesamte Historie rückwirkend reskalieren (Repainting). Diese Werte nicht neu berechnen, ohne die Versionierung mitzuziehen.

### Ausfalltoleranz — mehrschichtig und beabsichtigt

Beim Ändern von `sources.ts` oder `build-snapshot.ts` unbedingt erhalten:

1. **Quellenebene:** Yahoo primär, Stooq als Fallback, beide mit Retry und wachsendem Backoff. Krypto führt drei Quellen zusammen (Coin Metrics für die tiefe Historie, Yahoo und CoinGecko für die jüngsten Tage).
2. **Metrikebene:** `Promise.allSettled` — eine gescheiterte Metrik landet in `snapshot.failed[]` und bricht den Lauf nicht ab. Requests starten gestaffelt, um Rate-Limits zu schonen.
3. **Qualitäts-Gate:** Unter `MIN_FRESH = 3` frischen Metriken beendet sich der Lauf mit Exit 1 und schreibt **nichts** — ein kaputter Lauf fasst den letzten guten Stand nicht an.
4. **Carry-over:** Fehlende Metriken werden aus dem Vortagesstand übernommen, mit ehrlich wachsendem `staleDays`. Die Seite verliert nie Karten, sie altert sichtbar.
5. **Archivrotation:** `data/archive/` behält 90 Tage.

Das Frontend spiegelt das: `AppComponent` warnt bei `failed.length > 0`, bei `ageDays > 2` und bei `bootstrap === true` (Demo-JSON aus dem Build-Paket, echter Lauf lief noch nie).

## Angular-Konventionen

Angular 22 in moderner Form — beim Erweitern denselben Stil halten:

- **Zoneless.** Bootstrap in `src/main.ts` mit `provideZonelessChangeDetection()`, `polyfills: []` in `angular.json`, kein zone.js im Build.
- Standalone Components ohne `standalone: true`, durchgehend `ChangeDetectionStrategy.OnPush`.
- Signals (`signal`, `computed`, `resource()`) statt RxJS-Subscriptions für Daten. `MarketDataService` nutzt den `@Service()`-Decorator.
- Signal Forms (`@angular/forms/signals`, `FormField`) — siehe `generator.component.ts`. Kein `ReactiveFormsModule`.
- Built-in Control Flow `@if` / `@for`, keine `*ngIf` / `*ngFor`.
- Inline-Templates mit Tailwind-Klassen; Farben und Abstände aus `tailwind.config.js`.
- Alle Seiten sind `loadComponent`-lazy; Routen stehen in `src/app/app.ts`, nicht in einer eigenen Routes-Datei. Jede Route trägt ein `title`; `AppTitleStrategy` (`src/app/core/title-strategy.ts`) hängt den Seitennamen an.
- **Keine exportierten Klassen in `src/main.ts`.** Eine dort exportierte `@Injectable`-Klasse zwingt den Builder, das Hauptbundle in einen 55-Byte-Stub plus Lazy-Chunk zu zerlegen — ein zusätzlicher Roundtrip vor dem ersten Rendern. Deshalb liegt die TitleStrategy in einer eigenen Datei.

**Es gibt keine Netlify Functions mehr.** Das halbfertige Double-Opt-In-Abosystem (`netlify/functions/_shared.ts`, `unsubscribe.ts`) wurde entfernt: es hatte keinen Einstiegspunkt im Frontend, leitete auf eine nicht existierende `/report`-Route weiter, und `@netlify/blobs` war die einzige Quelle sämtlicher High-Vulns in den Produktionsabhängigkeiten. Wird es neu gebaut, gehört es komplett neu aufgesetzt — inklusive Formular, `subscribe`/`confirm` und `/report`-Seite.

## Deployment

`netlify.toml` ist maßgeblich und überschreibt die UI-Einstellungen: Build `npm ci && npx ng build`, Publish `dist/macro-ng/browser` (der Application-Builder legt unter `outputPath` einen `browser/`-Unterordner an), SPA-Fallback auf `index.html`, dazu `NODE_VERSION`, Cache- und Security-Header.

### Die CSP ist strikt — und das hat zwei harte Konsequenzen

`script-src` erlaubt **kein** `'unsafe-inline'`. Daraus folgt:

1. **`inlineCritical` muss in `angular.json` abgeschaltet bleiben.** Ist es an, schreibt der Builder `<link rel="stylesheet" media="print" onload="this.media='all'">` in die `index.html`. Die CSP blockiert dieses Inline-`onload`, `media` bleibt auf `print` — und **die gesamte Seite rendert ungestylt**. Der Build sieht dabei völlig unauffällig aus; das fällt nur beim Öffnen im Browser auf.
2. **Kein Inline-`<script>` und keine `onclick=`-Attribute in `public/*.html`.** `docs.html` lädt sein JS deshalb aus `public/docs.js` und seine Styles aus `public/docs.css`, die Kopier-Buttons hängen an einer Delegation auf `.copybtn`. `style="…"`-Attribute sind erlaubt (`style-src` hat `'unsafe-inline'`, Angular braucht das für `[style.x]`-Bindings).

Wer eine externe Quelle dazunimmt (Skript, Bild, Fetch-Ziel), muss die passende Direktive in `netlify.toml` erweitern — sonst scheitert es still im Browser.

### Caching

Immutable-Caching gilt nur für gehashte Artefakte (`/main-*.js`, `/chunk-*.js`, `/styles-*.css`, `/media/*`). `docs.html`, `docs.css` und `docs.js` sind **nicht** gehasht und dürfen deshalb keine Immutable-Regel bekommen. `Cache-Control` steht bewusst nirgends im globalen `/*`-Block, damit auf keinem Pfad zwei Regeln denselben Header setzen.

### Snapshot-Workflow

Braucht `permissions: contents: write` und pusht als `snapshot-bot` direkt auf `main`; jeder erfolgreiche Lauf löst einen Netlify-Build aus. Der Job installiert per `npm ci` (tsx kommt aus dem Lockfile, nicht per `npx -y`), prüft mit `npm run typecheck` die Typen, bevor er Daten anfasst, und rebased vor dem Push in drei Versuchen. `concurrency: snapshot` verhindert, dass zwei Läufe sich überholen.

### Sonstiges

Analytics läuft über GoatCounter (`src/index.html`), Seitenwechsel werden in `AppComponent` manuell gezählt. Cookiefrei, daher ohne Consent-Banner.

`/impressum` und `/datenschutz` sind Routen wie jede andere. **Im Impressum stehen noch `AUSFÜLLEN`-Platzhalter** — solange die drin sind, ist die Anbieterkennzeichnung unvollständig. Die Datenschutzerklärung beschreibt den realen Stand (Netlify, GoatCounter, GitHub-Raw-Abruf, selbst gehostete Schriften) und muss angepasst werden, sobald Funktionen dazukommen.
