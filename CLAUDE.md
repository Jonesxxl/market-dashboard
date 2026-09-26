# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Überblick

Macro Risk Dashboard — bewertet Krypto, Edelmetalle, Nasdaq/KI und Währungen danach, wie günstig oder teuer sie **relativ zu ihrer eigenen Historie** stehen. Angular-22-SPA auf Netlify, gefüttert von einem GitHub-Actions-Lauf alle zwei Tage.

**Projektsprache ist Deutsch.** UI-Texte, Code-Kommentare, Commit-Messages und vor allem die `interpret`-Strings der Metriken sind durchgehend deutsch und richten sich an Laien, nicht an Finanzprofis. Neue Texte in diesem Ton und dieser Sprache schreiben.

## Befehle

**Node 24 ist Pflicht** (`.nvmrc`, `engines`, `NODE_VERSION` in `netlify.toml`). Angular 22 verweigert unter v24.15.0 den Build — mit einer älteren Node-Version scheitert `npm run build` sofort.

```bash
npm ci                     # Abhängigkeiten (node_modules ist nicht eingecheckt)
npm start                  # Dev-Server auf http://localhost:4200
npm run build              # Produktionsbuild nach dist/macro-ng/browser
npm run typecheck          # Typen von scripts/ + metrics-core/ + tailwind.config.ts (läuft auch im Cron)
npm run test:core          # Tests des Rechenkerns (Node-Test-Runner, kein Netz, datumsunabhängig)
npm run snapshot           # Snapshot lokal bauen — schreibt public/snapshot.json!
netlify dev --dir dist/macro-ng/browser   # Gebautes Ergebnis mit netlify.toml-Headern servieren
gh workflow run snapshot.yml --ref main   # Snapshot-Lauf manuell auslösen
```

**Tests:** `npm run test:core` prüft den Rechenkern (`metrics-core/*.test.ts`) mit dem in Node eingebauten Test-Runner über tsx — ohne zusätzliche Abhängigkeiten, ohne Netz (`fetch` wird in den Tests ersetzt) und ohne Abhängigkeit vom heutigen Datum. Neue Tests dort ablegen und genauso halten, sonst werden sie an manchen Tagen rot. `npm test` (Karma) ist **nicht lauffähig**: `angular.json` verlangt `zone.js` als Test-Polyfill, das Paket ist nicht installiert, und es existiert keine `.spec.ts`. Ein Linter ist nicht eingerichtet.

`npm run snapshot` überschreibt `public/snapshot.json` und legt einen Archiveintrag an. Vor dem Ausführen bedenken, dass das ein Commit-relevanter Nebeneffekt ist. Zum gefahrlosen Testen den Builder in einem leeren Verzeichnis mit `public/` und `data/archive/` laufen lassen.

## Architektur

### Das Frontend rechnet nichts

Zentrale Entscheidung: Sämtliche Metrik-Berechnung passiert im Node-Lauf, der alle zwei Tage startet. Das Frontend lädt ausschließlich `/snapshot.json` und rendert es. `MarketDataService` hat genau einen `resource()`-Loader und keinerlei Marktlogik.

```
GitHub Action (cron 05:17 UTC an ungeraden Tagen + workflow_dispatch)
  └─ scripts/build-snapshot.ts  →  buildSnapshot(NODE_CTX)
       └─ schreibt public/snapshot.json + data/archive/<datum>.json
            └─ Commit als snapshot-bot  →  Webhook  →  Netlify-Build
                 └─ Angular lädt /snapshot.json
```

**Die Daten hängen bewusst nicht am Deploy.** `SNAPSHOT_REMOTE` in `src/app/core/market-data.service.ts` zeigt auf die Raw-URL des Repos; die mitgebaute `/snapshot.json` ist nur noch Fallback. Scheitert ein Netlify-Build, bleiben die Zahlen trotzdem aktuell. Wer die Raw-URL ändert, muss `connect-src` in der CSP (`netlify.toml`) mitziehen — sonst blockiert der Browser den Abruf und die Seite fällt still auf die Deploy-Kopie zurück.

**Auf localhost gilt die lokale Datei.** Sonst zeigt die Entwicklungsumgebung die Produktionsdaten von GitHub, und ein frisch gebauter Snapshot bliebe unsichtbar — ein Effekt, der beim Testen von Metrik-Änderungen sehr verlässlich in die Irre führt.

### metrics-core/ — geteilter, plattformneutraler Kern

Läuft in Node **und** im Browser, deshalb keine Node-Imports darin. Faustregel: Alles, was Cron, Build-Skripte und Frontend gemeinsam brauchen, gehört hierher — auch wenn es keine Metrik ist (Farben, Seiten-Metadaten). `FetchContext` abstrahiert nur die Basis-URLs (Node: direkte URLs; Browser wäre über Proxy-Pfade gedacht, ist aktuell aber nicht verdrahtet — es gibt keine Proxy-Config in `angular.json`).

| Datei | Rolle |
|---|---|
| `types.ts` | Alle geteilten Typen. `Snapshot` ist der Vertrag zwischen Cron und Frontend. |
| `math.ts` | Reine Funktionen, keine Abhängigkeiten. `computeHeat`, `computeRisk`, `percentileRank`, `equalWeightIndex` (beide Körbe), `formatValue` (Anzeige-Nachkommastellen). |
| `palette.ts` | **Einzige Quelle aller Farbwerte.** Gelesen von `tailwind.config.ts`, den Charts, den Komponenten und der Registry. |
| `site.ts` | Domain, Seitentitel und Beschreibungen — gelesen von den Routen, der TitleStrategy und dem Generator der statischen Seiten. |
| `lage.ts` | **Die einzige Einordnung** eines Werts (Kaufzone, Warnzone, ungewöhnlich tief/hoch, Mittelfeld). Gelesen von den Deutungstexten, der Startseite und dem Generator. |
| `sources.ts` | Datenbeschaffung inkl. Fallbacks und Retries. |
| `metrics.ts` | **Die Registry.** Eine Metrik = ein Eintrag. |
| `snapshot.ts` | Baut den Snapshot, inkl. abgeleiteter Blöcke (Ratios, Bärenmarkt, KI-Blase). |
| `allocation.ts` | Regelwerk hinter der Generator-Seite. |

**Neue Metrik hinzufügen = ein Eintrag in `REGISTRY` in `metrics.ts`.** Snapshot-Builder, Frontend und Generator iterieren darüber und sehen sie automatisch. Eine `MetricDefinition` liefert `fetch`, `compute`, `interpret` und optional `extra` sowie `short` (Kurzname für Listen, nötig, wenn der Teil des Labels vor „ · " nicht eindeutig ist, wie beim MVRV-Z-Score).

**Metriken umbenennen oder entfernen ist gefahrlos**, weil `build-snapshot.ts` nur noch Metriken aus dem vorigen Lauf übernimmt, deren ID weiterhin in `REGISTRY` steht. Ohne diesen Filter würde eine gelöschte Metrik über den Carry-over täglich neu eingesetzt und als immer älter werdende Karte weiterleben.

### Zwei Konventionen, die man kennen muss

**Währungen notieren den Dollar als Basiswährung** — eine steigende Kurve heißt bei den Dollar-Paaren „stärkerer Dollar". Yahoo und Stooq liefern EUR/USD in der Gegenrichtung, deshalb hat `fxDef` einen `invert`-Parameter, der die Reihe kehrwertet (`usdeur`). Das ist kein Anzeigetrick: Der Heat-Wert wird auf der invertierten Reihe neu berechnet, denn `ln(1/P ÷ SMA200(1/P))` ist nicht das negierte `ln(P ÷ SMA200(P))`. **Einzige Ausnahme ist `chfeur`**, ein Kreuzpaar ohne Dollar (Euro je Franken) — beim Ergänzen weiterer Kreuzpaare den Seitentext mitziehen, sonst behauptet er eine Leserichtung, die nicht mehr für alle gilt.

**Eine Einordnung für alle.** Ob ein Wert „Kaufzone", „Warnzone", „ungewöhnlich tief/hoch" oder „im Mittelfeld" heißt, entscheidet ausschließlich `einordnenAngezeigt()` in `metrics-core/lage.ts` — aus den `zones`/`hotAbove` der Metrik, mit denselben Vergleichen wie die Chips. `interpret(r, e)` bekommt diese Einordnung übergeben; **Deutungstexte formulieren Zonen-Aussagen nur aus `e`, nie mit eigenen Schwellen.** Vorher hatte jede Stelle eigene, und Ethereum bei 0,504 hieß auf der Karte „heißgelaufen", auf der Startseite „im Mittelfeld", im Generator „neutral". Eingeordnet wird der Wert **so gerundet, wie er angezeigt wird** (Risk drei, Heat zwei Stellen); sonst stand „0.15 · Kaufzone" neben dem Chip „Kaufzone < 0.15". Ein Test in `lage.test.ts` fährt jede Registry-Metrik über 0,01 … 0,99 und schlägt an, sobald ein Text der Einordnung widerspricht — neue Metriken sind damit automatisch abgedeckt.

**Zonenlinien nur, wo es Zonen gibt.** `sparklineSvg` zeichnet die gestrichelten Linien bei 0,15/0,85 samt Beschriftung „Kauf-/Warnzone" nur, wenn die Metrik `zones` oder `hotAbove` gesetzt hat. Währungen haben beides nicht — dort wären sie eine Behauptung, die der Seitentext ausdrücklich verneint. Den Schalter setzt `metric-card.component.ts` aus der Metrik selbst, nicht die Aufrufstelle. Dasselbe gilt für die Farben: Ohne Zonen bekommen Rail und Startseiten-Skala das neutrale Band (`bg-skala-neutral`, hell an beiden Rändern, ohne Türkis/Rot), und auf der Startseite heißt „ungewöhnlich tief" bei Währungen „Dollar/Franken ungewöhnlich schwach" (`lageWort`).

**Körbe skalieren ihren Index auf 100 $.** `dai-basket-heat` ist ein gleichgewichteter Index ohne eigenen Marktpreis; `fetch` multipliziert die auf 1 normierte Reihe mit 100, damit ein lesbarer Dollar-Verlauf entsteht. Der Heat-Wert ändert sich dadurch nicht, weil `ln(kP / kSMA) = ln(P / SMA)`. Wer die Skalierung anfasst, ändert also nur die Anzeige — aber `stats` (52-Wochen-Spanne, Abstand zum Höchststand) hängt mit dran. Der Kurschart wird über `extra.priceChart` aktiviert, der erklärende Text darunter über `extra.priceNote`. Achtung: `r.dates[0]` ist dort **nicht** das Normierungsdatum, sondern liegt 200 Handelstage später — der SMA200 braucht diesen Vorlauf.

### Metrik-Arten — alle auf 0…1 normiert

- **`heat`** (Metalle, Aktien, FX, Baskets): historisches Perzentil von `ln(Preis / SMA200)`. `0.10` heißt: nur an 10 % aller Tage war das Asset günstiger zu seinem Trend.
- **`risk`** (BTC, ETH): min-max-normiertes `ln(Preis/SMA_W) × Tagesindex^exp`, 0 = Bodenniveau, 1 = Topniveau. `W`, `exp` und die Normierungsgrenzen stehen je Asset in `RISK_CONSTANTS`.
- **Fertige Kennzahlen** (`btc-mvrv-z`): `computeIndicator` in `math.ts` nimmt eine Reihe, die bereits eine Kennzahl ist, behält den Rohwert als `price` und setzt `value` auf dessen historisches Perzentil. Trägt `kind: 'heat'`, weil sich Rail und Zonen genauso verhalten. **Anders als `computeHeat` wird nichts logarithmiert — negative Werte sind zulässig.** Für die Anzeige gibt es vier optionale Schalter in `extra`: `priceLabel` (ersetzt „Kurs" in der Statistikzeile und im Chart), `valueLabel` (Erklärzeile neben dem großen Wert), `hideAth` (blendet „vom Höchststand" aus) und `priceChart`/`priceNote`.

**MVRV-Z-Score:** `(Börsenwert − Realized Value) ÷ Standardabweichung(Börsenwert)`, Standardabweichung **expandierend** über die bis dahin bekannte Historie — eine feste über die Gesamthistorie ergäbe eine völlig andere Reihe. Coin Metrics hat keine Realized-Cap-Spalte, sie folgt aber exakt aus `CapMrktCurUSD ÷ CapMVRVCur`. Die Community-CSV hängt rund zweieinhalb Monate zurück, deshalb ergänzt `bitcoin-data.com` die jüngsten Tage; über 1382 gemeinsame Tage beträgt die mittlere Abweichung 0,009, die Reihen sind also identisch skaliert und dürfen zusammengesetzt werden. Die ersten `MVRV_WARMUP = 365` Tage entfallen, weil die Standardabweichung aus wenigen Anfangstagen Werte über 30 erzeugt.

Die Normierungskonstanten in `RISK_CONSTANTS` (`math.ts`) sind **eingefroren** (v1, fixiert 2026-07-19). Das ist Absicht: Sonst würde ein neues Extrem die gesamte Historie rückwirkend reskalieren (Repainting). Diese Werte nicht neu berechnen, ohne die Versionierung mitzuziehen.

### Ausfalltoleranz — mehrschichtig und beabsichtigt

Beim Ändern von `sources.ts` oder `build-snapshot.ts` unbedingt erhalten:

1. **Quellenebene:** Yahoo primär, Stooq als Fallback, beide mit Retry und wachsendem Backoff. Krypto führt drei Quellen zusammen (Coin Metrics für die tiefe Historie, Yahoo und CoinGecko für die jüngsten Tage).
2. **Metrikebene:** `Promise.allSettled` — eine gescheiterte Metrik landet in `snapshot.failed[]` und bricht den Lauf nicht ab. Requests starten gestaffelt, um Rate-Limits zu schonen.
3. **Qualitäts-Gate:** Unter `MIN_FRESH = 3` frischen Metriken beendet sich der Lauf mit Exit 1 und schreibt **nichts** — ein kaputter Lauf fasst den letzten guten Stand nicht an.
4. **Carry-over:** Fehlende Metriken werden aus dem vorigen Lauf übernommen, mit ehrlich wachsendem `staleDays`. Die Seite verliert nie Karten, sie altert sichtbar.
5. **Archivrotation:** `data/archive/` behält die letzten 90 Läufe (`ARCHIVE_KEEP` zählt Läufe, nicht Tage) — im 2-Tage-Takt also rund 180 Tage.

Das Frontend spiegelt das: `AppComponent` warnt bei `failed.length > 0`, bei `ageDays > 2 × SNAPSHOT_INTERVAL_DAYS` (ein einzelner ausgefallener Lauf bleibt also still) und bei `bootstrap === true` (Demo-JSON aus dem Build-Paket, echter Lauf lief noch nie).

## Angular-Konventionen

Angular 22 in moderner Form — beim Erweitern denselben Stil halten:

- **Zoneless.** Bootstrap in `src/main.ts` mit `provideZonelessChangeDetection()`, `polyfills: []` in `angular.json`, kein zone.js im Build.
- Standalone Components ohne `standalone: true`, durchgehend `ChangeDetectionStrategy.OnPush`.
- Signals (`signal`, `computed`, `resource()`) statt RxJS-Subscriptions für Daten. `MarketDataService` nutzt den `@Service()`-Decorator.
- Signal Forms (`@angular/forms/signals`, `FormField`) — siehe `generator.component.ts`. Kein `ReactiveFormsModule`.
- Built-in Control Flow `@if` / `@for`, keine `*ngIf` / `*ngFor`.
- Inline-Templates mit Tailwind-Klassen; Farben aus `metrics-core/palette.ts` (über `tailwind.config.ts` auch als Klassen wie `text-lo`, `bg-panel`, `bg-skala`). **Keine Hex-Literale in Komponenten oder Charts** — wo keine Klasse geht (`[style.color]`, SVG-Strings), `PALETTE.x` importieren.
- Karten nutzen `.card` (Fläche, Kante, Radius) und `.card-title` (kleine Versal-Überschrift) aus `src/styles.css`; Innen- und Außenabstand setzt die Aufrufstelle. Abweichungen per Utility (`card border-dashed`), die liegen in der späteren Schicht und gewinnen.
- Metrik-Karten eines Bereichs über `<app-metric-list [metrics]="…" [skeletonCount]="n"/>` — sie bringt Ladeplatzhalter und Leerzustand mit. Nicht wieder pro Seite nachbauen.
- Einblend-Animationen hängen an `RevealDirective`: als `appReveal`-Attribut im Template oder als `hostDirectives: [RevealDirective]` in einer Komponente (so bei `app-chart` und `app-rail`). Kein `classList` von Hand.
- Texte aus dem Snapshot mit `<b>`-Auszeichnung (`interpret`, `note`) per `[innerHTML]` **ohne** `bypassSecurityTrustHtml` einbinden und am Container `[&_b]:text-fg` setzen. Die Daten kommen von einer externen URL; Angulars Standard-Bereinigung lässt `<b>` stehen. Der einzige legitime Bypass ist `ChartComponent`, weil die Bereinigung SVG komplett entfernen würde und die Strings nur aus Zahlen in `core/charts.ts` entstehen.
- Chart-Funktionen in `core/charts.ts` nehmen ein Options-Objekt und liefern `ChartSvg` (`{ svg, tip }`). `tip.frame` ist der Zeichenrahmen, mit dem der Tooltip die Mausposition umrechnet — wer einen Chart mit anderen Rändern baut, gibt seinen `Frame` mit, statt im Tooltip Konstanten zu ändern.
- **Bedienelemente nutzen die `.btn`-Klassen aus `src/styles.css`** (`@layer components`), nicht handgeschriebene Utility-Ketten: `.btn` plus `.btn-ghost` (Standard), `.btn-primary` (getroffene Wahl), `.btn-sel` (nachrangig ausgewählt), `.btn-sm` (dichte Gruppen), `.btn-on` (aktive Route via `routerLinkActive`). `.btn-on` und `.btn-sel` müssen in der Datei **nach** `.btn-ghost` stehen, sonst gewinnt dessen `:hover`-Regel bei gleicher Spezifität. Der `focus-visible`-Ring hängt an `.btn` — auf dunklem Grund wäre Tastaturnavigation sonst unsichtbar.
- Alle Seiten sind `loadComponent`-lazy; Routen stehen in `src/app/app.ts`, nicht in einer eigenen Routes-Datei. Jede Route trägt ein `title`; `AppTitleStrategy` (`src/app/core/title-strategy.ts`) hängt den Seitennamen an.
- **Keine exportierten Klassen in `src/main.ts`.** Eine dort exportierte `@Injectable`-Klasse zwingt den Builder, das Hauptbundle in einen 55-Byte-Stub plus Lazy-Chunk zu zerlegen — ein zusätzlicher Roundtrip vor dem ersten Rendern. Deshalb liegt die TitleStrategy in einer eigenen Datei.

**Es gibt keine Netlify Functions mehr.** Das halbfertige Double-Opt-In-Abosystem (`netlify/functions/_shared.ts`, `unsubscribe.ts`) wurde entfernt: es hatte keinen Einstiegspunkt im Frontend, leitete auf eine nicht existierende `/report`-Route weiter, und `@netlify/blobs` war die einzige Quelle sämtlicher High-Vulns in den Produktionsabhängigkeiten. Wird es neu gebaut, gehört es komplett neu aufgesetzt — inklusive Formular, `subscribe`/`confirm` und `/report`-Seite.

## Deployment

`netlify.toml` ist maßgeblich und überschreibt die UI-Einstellungen: Build `npm ci && npm run build`, Publish `dist/macro-ng/browser` (der Application-Builder legt unter `outputPath` einen `browser/`-Unterordner an), SPA-Fallback auf `index.html`, dazu `NODE_VERSION`, Cache- und Security-Header.

### Die CSP ist strikt — und das hat zwei harte Konsequenzen

`script-src` erlaubt **kein** `'unsafe-inline'`. Daraus folgt:

1. **`inlineCritical` muss in `angular.json` abgeschaltet bleiben.** Ist es an, schreibt der Builder `<link rel="stylesheet" media="print" onload="this.media='all'">` in die `index.html`. Die CSP blockiert dieses Inline-`onload`, `media` bleibt auf `print` — und **die gesamte Seite rendert ungestylt**. Der Build sieht dabei völlig unauffällig aus; das fällt nur beim Öffnen im Browser auf.
2. **Kein Inline-`<script>` und keine `onclick=`-Attribute in `public/*.html`.** `docs.html` lädt sein JS deshalb aus `public/docs.js` und seine Styles aus `public/docs.css`, die Kopier-Buttons hängen an einer Delegation auf `.copybtn`. `style="…"`-Attribute sind erlaubt (`style-src` hat `'unsafe-inline'`, Angular braucht das für `[style.x]`-Bindings).

Wer eine externe Quelle dazunimmt (Skript, Bild, Fetch-Ziel), muss die passende Direktive in `netlify.toml` erweitern — sonst scheitert es still im Browser.

### Caching

Immutable-Caching gilt nur für gehashte Artefakte (`/main-*.js`, `/chunk-*.js`, `/styles-*.css`, `/media/*`). `docs.html`, `docs.css` und `docs.js` sind **nicht** gehasht und dürfen deshalb keine Immutable-Regel bekommen. `Cache-Control` steht bewusst nirgends im globalen `/*`-Block, damit auf keinem Pfad zwei Regeln denselben Header setzen.

### Snapshot-Workflow

Braucht `permissions: contents: write` und pusht als `snapshot-bot` direkt auf `main`; jeder erfolgreiche Lauf löst einen Netlify-Build aus. Der Job installiert per `npm ci` (tsx kommt aus dem Lockfile, nicht per `npx -y`), prüft mit `npm run typecheck` die Typen, bevor er Daten anfasst, und rebased vor dem Push in drei Versuchen. `concurrency: snapshot` verhindert, dass zwei Läufe sich überholen.

**Takt: alle zwei Tage** (`17 5 */2 * *`, also an jedem ungeraden Monatstag; nach einem 31. folgt direkt der 1.). Der Takt steht an drei Stellen, die zusammengehören: im cron, in `SNAPSHOT_INTERVAL_DAYS` (`metrics-core/site.ts`, daraus leitet die Seite ab, ab wann Daten als veraltet gelten) und ausgeschrieben als „alle zwei Tage" in den Texten — Kopf der Startseite, Footer, Datenschutzerklärung, `index.html` (Meta-Beschreibungen, JSON-LD, FAQ), `llms.txt`, `docs.html` und die statischen Seiten. Wer den Takt ändert, sucht nach „alle zwei Tage", sonst behauptet die Seite einen Rhythmus, den es nicht gibt.

### Statische Seiten je Route — wichtig

`npm run build` ist **nicht** nur `ng build`: Danach läuft `scripts/build-static-pages.ts` und schreibt für jede Route eine echte `index.html` mit Inhalt nach `dist/macro-ng/browser/<route>/`. Grund: Die Seite ist eine Client-SPA, und **GPTBot, ClaudeBot, PerplexityBot und OAI-SearchBot führen kein JavaScript aus**. Vorher sahen sie 197 Zeichen `noscript`-Text, und `/krypto` war nicht von `/metalle` zu unterscheiden — inklusive Titel und Meta-Beschreibung, die erst JavaScript setzt.

Der Generator schreibt den Inhalt direkt in `<app-root>`. Angular leert das Host-Element beim Bootstrap (`selectRootElement` ohne `preserveContent`) und übernimmt danach — es ist also kein Duplikat, sondern der Zustand vor dem Start. Nachgeprüft: nach dem Booten steht kein statischer Rest mehr im DOM.

**Wer `netlify.toml` oder das `build`-Skript anfasst, muss den Generator mitziehen** — läuft er nicht, fällt die Seite still auf den leeren Shell zurück und ist für KI-Suchen wieder unsichtbar. `sitemap.xml` entsteht im selben Lauf (mit `lastmod` aus dem Snapshot) und liegt deshalb **nicht** mehr in `public/`.

### SEO, auch für Sprachmodelle

`public/llms.txt` fasst Methodik, Konventionen, Datenquellen und Grenzen in Textform zusammen (Format nach llmstxt.org), `public/robots.txt` gibt die gängigen KI-Crawler ausdrücklich frei. In `src/index.html` steht ein JSON-LD-Block mit `WebSite`, `Dataset` (zeigt auf `snapshot.json`) und `FAQPage`. **Der ld+json-Block ist ein Datenblock, kein ausführbares Skript — die strikte `script-src`-Direktive greift dort nicht.**

Titel, Meta-Beschreibung, OG-Tags und Canonical setzt `AppTitleStrategy` pro Route aus `title` und `data.description`. Die Texte selbst stehen in `metrics-core/site.ts`, damit Browser und statische Seiten dieselbe Beschreibung zeigen; der Generator hängt bei den Datenseiten nur den aktuellen Wert an. Inhaltliche Änderungen an einer Metrik-Konvention gehören an vier Stellen nachgezogen: Registry, Seitentext, `llms.txt` und der FAQ-Block in `index.html`.

### Sonstiges

Analytics läuft über GoatCounter (`src/index.html`), Seitenwechsel werden in `AppComponent` manuell gezählt. Cookiefrei, daher ohne Consent-Banner.

`/impressum` und `/datenschutz` sind Routen wie jede andere. **Im Impressum stehen noch `AUSFÜLLEN`-Platzhalter** — solange die drin sind, ist die Anbieterkennzeichnung unvollständig. Die Datenschutzerklärung beschreibt den realen Stand (Netlify, GoatCounter, GitHub-Raw-Abruf, selbst gehostete Schriften) und muss angepasst werden, sobald Funktionen dazukommen.
