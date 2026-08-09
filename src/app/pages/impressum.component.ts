import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Pflichtangaben nach § 5 DDG. Die mit AUSFÜLLEN markierten Stellen müssen vor dem
 *  öffentlichen Betrieb durch echte Daten ersetzt werden — eine Anbieterkennzeichnung
 *  mit Platzhaltern gilt als fehlend. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-impressum',
  template: `
    <article class="bg-panel border border-line rounded-2xl p-6 md:p-8 max-w-3xl">
      <h2 class="text-2xl font-bold text-fg mb-6">Impressum</h2>

      <div class="font-mono text-[12.5px] text-mid border border-dashed border-mid rounded-xl px-4 py-3 mb-7">
        Hinweis an den Betreiber: Alle mit <b>AUSFÜLLEN</b> markierten Felder ersetzen. Solange
        Platzhalter stehen, ist die Anbieterkennzeichnung unvollständig.
      </div>

      <h3 class="text-fg font-bold text-base mb-2">Angaben gemäß § 5 DDG</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        AUSFÜLLEN: Vor- und Nachname<br>
        AUSFÜLLEN: Straße und Hausnummer<br>
        AUSFÜLLEN: Postleitzahl und Ort<br>
        AUSFÜLLEN: Land
      </p>

      <h3 class="text-fg font-bold text-base mb-2">Kontakt</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        E-Mail: AUSFÜLLEN: Kontaktadresse<br>
        <span class="text-faint">Eine Telefonnummer ist nicht verpflichtend, solange ein zweiter
        elektronischer Kontaktweg für eine schnelle Kommunikation zur Verfügung steht.</span>
      </p>

      <h3 class="text-fg font-bold text-base mb-2">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        AUSFÜLLEN: Vor- und Nachname, Anschrift wie oben
      </p>

      <h3 class="text-fg font-bold text-base mb-2">Keine Anlageberatung</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Dieses Dashboard ist ein privates, nicht-kommerzielles Statistikprojekt. Alle Kennzahlen sind
        rein historische Auswertungen und ausdrücklich <b class="text-fg">keine Anlageberatung, keine
        Anlagevermittlung und keine Kauf- oder Verkaufsempfehlung</b>. Es wird keine Gewähr für
        Richtigkeit, Vollständigkeit oder Aktualität der dargestellten Daten übernommen — sie stammen
        aus externen Quellen und können fehlerhaft, verzögert oder unvollständig sein. Jede
        Anlageentscheidung erfolgt in eigener Verantwortung und auf eigenes Risiko.
      </p>

      <h3 class="text-fg font-bold text-base mb-2">Haftung für Links</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Diese Seite verweist auf externe Websites Dritter, auf deren Inhalte kein Einfluss besteht.
        Für diese fremden Inhalte wird keine Gewähr übernommen; verantwortlich ist stets der jeweilige
        Anbieter der verlinkten Seiten. Bei bekannt werdenden Rechtsverstößen werden entsprechende
        Links umgehend entfernt.
      </p>

      <h3 class="text-fg font-bold text-base mb-2">Streitbeilegung</h3>
      <p class="text-muted text-[14px] leading-relaxed">
        Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        besteht weder Bereitschaft noch Verpflichtung.
      </p>
    </article>
  `,
})
export class ImpressumComponent {}
