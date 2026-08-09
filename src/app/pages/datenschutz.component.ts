import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Datenschutzerklärung. Inhaltlich auf das zugeschnitten, was diese Seite tatsächlich tut:
 *  keine Cookies, kein LocalStorage, keine Formulare, keine Konten. Verbindungen entstehen zu
 *  Netlify (Hosting), GoatCounter (Reichweitenmessung) und GitHub (Abruf des Snapshots).
 *  Nur die Angaben zum Verantwortlichen sind Platzhalter. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-datenschutz',
  template: `
    <article class="bg-panel border border-line rounded-2xl p-6 md:p-8 max-w-3xl">
      <h2 class="text-2xl font-bold text-fg mb-6">Datenschutzerklärung</h2>

      <div class="font-mono text-[12.5px] text-mid border border-dashed border-mid rounded-xl px-4 py-3 mb-7">
        Hinweis an den Betreiber: Nur die mit <b>AUSFÜLLEN</b> markierten Felder im Abschnitt
        „Verantwortlicher" ergänzen. Der übrige Text beschreibt bereits exakt das reale Verhalten
        dieser Seite — er muss angepasst werden, sobald Funktionen dazukommen.
      </div>

      <h3 class="text-fg font-bold text-base mb-2">1. Verantwortlicher</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Verantwortlich im Sinne der DSGVO ist:<br>
        AUSFÜLLEN: Vor- und Nachname<br>
        AUSFÜLLEN: Straße und Hausnummer<br>
        AUSFÜLLEN: Postleitzahl und Ort<br>
        E-Mail: AUSFÜLLEN: Kontaktadresse
      </p>

      <h3 class="text-fg font-bold text-base mb-2">2. Das Wichtigste vorweg</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Diese Seite setzt <b class="text-fg">keine Cookies</b>, nutzt weder LocalStorage noch
        SessionStorage, enthält keine Formulare, keine Registrierung und kein Nutzerkonto. Es werden
        keine personenbezogenen Daten von dir gespeichert, um dich wiederzuerkennen. Auch der
        Sparplan- und Rebalancing-Generator rechnet vollständig in deinem Browser — die dort
        eingegebenen Beträge werden nirgendwohin übertragen und nicht gespeichert.
      </p>

      <h3 class="text-fg font-bold text-base mb-2">3. Hosting und Server-Logdateien</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Die Seite wird bei <b class="text-fg">Netlify</b> (Netlify, Inc., 512 2nd Street, San Francisco,
        CA 94107, USA) gehostet. Beim Aufruf verarbeitet Netlify technisch notwendige Verbindungsdaten
        wie IP-Adresse, Zeitpunkt der Anfrage, aufgerufene Adresse, übertragene Datenmenge, Browsertyp
        und Betriebssystem. Diese Verarbeitung ist für die Auslieferung der Seite und ihre technische
        Sicherheit unerlässlich. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
        am sicheren und störungsfreien Betrieb). Da Netlify seinen Sitz in den USA hat, kann es zu einer
        Übermittlung in ein Drittland kommen; Netlify ist nach dem EU-US Data Privacy Framework
        zertifiziert und es bestehen Standardvertragsklauseln.
      </p>

      <h3 class="text-fg font-bold text-base mb-2">4. Reichweitenmessung mit GoatCounter</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Zur Messung der Seitenaufrufe kommt <b class="text-fg">GoatCounter</b> zum Einsatz. GoatCounter
        arbeitet <b class="text-fg">ohne Cookies</b> und legt keine geräteübergreifend wiedererkennbaren
        Kennungen an. Erfasst werden die aufgerufene Adresse, die verweisende Seite, grobe Browser- und
        Länderinformationen sowie der Zeitpunkt. Die IP-Adresse wird ausschließlich flüchtig verarbeitet
        und nicht dauerhaft gespeichert. Eine Zuordnung zu deiner Person ist damit nicht möglich.
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer datensparsamen
        Auswertung der Seitennutzung). Da keine Informationen auf deinem Endgerät gespeichert oder
        ausgelesen werden, ist keine Einwilligung nach § 25 TDDDG erforderlich — deshalb gibt es hier
        auch kein Cookie-Banner. Das Zählskript wird von <code class="text-fg">gc.zgo.at</code> geladen,
        die Zählung erfolgt gegen <code class="text-fg">papayo.goatcounter.com</code>.
      </p>

      <h3 class="text-fg font-bold text-base mb-2">5. Abruf der Marktdaten von GitHub</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Die angezeigten Kennzahlen werden einmal täglich vorberechnet und als Datei
        <code class="text-fg">snapshot.json</code> in einem öffentlichen GitHub-Repository abgelegt.
        Dein Browser lädt diese Datei direkt von <code class="text-fg">raw.githubusercontent.com</code>
        (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA). Dabei wird deine
        IP-Adresse an GitHub übertragen — technisch unvermeidbar, da ohne sie keine Verbindung
        zustande käme. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
        tagesaktuellen Daten, die auch dann noch stimmen, wenn ein Deployment fehlschlägt). Ist GitHub
        nicht erreichbar, greift die Seite auf eine mitausgelieferte Kopie auf dem eigenen Server
        zurück; dann entsteht keine Verbindung zu GitHub.
      </p>

      <h3 class="text-fg font-bold text-base mb-2">6. Schriftarten</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Alle Schriften werden vom eigenen Server ausgeliefert. Es besteht
        <b class="text-fg">keine Verbindung zu Google Fonts</b> oder einem anderen Font-Dienst.
      </p>

      <h3 class="text-fg font-bold text-base mb-2">7. Speicherdauer</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Server-Logdateien werden von Netlify nach dessen Aufbewahrungsfristen automatisch gelöscht.
        Die aggregierten Zählwerte von GoatCounter enthalten keinen Personenbezug und werden für die
        laufende Auswertung vorgehalten. Darüber hinaus werden von dieser Seite keine Daten gespeichert.
      </p>

      <h3 class="text-fg font-bold text-base mb-2">8. Deine Rechte</h3>
      <p class="text-muted text-[14px] leading-relaxed mb-6">
        Dir stehen die Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
        Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie ein
        <b class="text-fg">Widerspruchsrecht</b> gegen Verarbeitungen auf Grundlage berechtigter
        Interessen (Art. 21 DSGVO) zu. Wende dich dafür an die oben genannte Kontaktadresse. Bitte
        beachte: Da keine Daten mit Personenbezug gespeichert werden, ist eine Zuordnung zu deiner
        Person in der Regel nicht möglich — in diesem Fall können Auskunfts- und Löschansprüche
        naturgemäß ins Leere gehen (Art. 11 DSGVO).
      </p>

      <h3 class="text-fg font-bold text-base mb-2">9. Beschwerderecht</h3>
      <p class="text-muted text-[14px] leading-relaxed">
        Unabhängig davon steht dir ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu,
        insbesondere in dem Mitgliedstaat deines Aufenthaltsorts, deines Arbeitsplatzes oder des Orts
        des mutmaßlichen Verstoßes (Art. 77 DSGVO).
      </p>
    </article>
  `,
})
export class DatenschutzComponent {}
