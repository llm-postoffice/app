// Die Naht zur Schreibschicht (Teil E): Teil D kennt nur diese Form. Ansichten fragen `kontext.schreiben`; ist es null,
// bietet die Ansicht den Knopf an, lässt ihn aber gesperrt und sagt in einem Satz, warum (kein vorgetäuschter Erfolg).
// Teil E setzt einen Schreiber mit diesen Funktionen ein; jede gibt eine Zusage zurück und reiht die Sendung in die
// Warteschlange (Speicher „schlange“, Felder siehe ansichtstexte.js schlangeZeile) statt sofort zu senden:
//
//   antworten(id, { wahl, text })            Antwort auf eine Frage; wahl ist der Schlüssel einer Möglichkeit
//   urteilSenden(id, { text })               Antwort auf eine Abnahme; text ist der Antworttext (abnahme.js antwortText)
//   erledigen(id)                            Eintrag erledigen
//   einsortieren(id, { ziel, satz })         Nachtrag mit To und Project; ziel ist „user“ oder ein Projektname
//   anlegen({ art, titel, an, text, rang, dringend })   neuer Eintrag
//   senden(id)                               Sendung aus dem Konflikt trotzdem senden (Trotzdem senden, Als Nachtrag senden)

/** Der Satz, den Ansichten neben einen gesperrten Knopf stellen, solange es keine Schreibschicht gibt. */
export const SENDEN_FEHLT = 'Diese Fassung liest nur. Senden kommt mit einer späteren Fassung; deine Eingabe bleibt auf diesem Gerät.';

/** Kann diese Fassung senden? */
export const kannSenden = (kontext) => Boolean(kontext?.schreiben);
