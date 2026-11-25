// Dateien anhängen: der Knopf „Datei anhängen“ öffnet die Dateiauswahl des Systems, darunter steht die Liste der gewählten Dateien mit Größe und Entfernen. Die Dateien liegen als Base64 im
// Entwurf `anhaenge/SCHLÜSSEL` auf dem Gerät, damit Zurück, Neuladen und das Beenden der App sie nicht kosten. Prüfen und
// Annehmen macht anhaenge.js (nimmAuf): zu groß, doppelter Name, Hinweis über 300 KiB; ein Foto kodiert
// verkleinern.js (bereiteVor) immer neu, ein PNG über 1 MiB auch.
import { el } from './dom.js';
import { ANHANG_MAX, BILD_QUELLE_MAX, bereiteVor, groessenWort, nimmAuf, wirdUmkodiert } from './anhaenge.js';
import { verkleinereBild } from './verkleinern.js';
import { knopf } from './karten.js';
import { liesEntwurf, speichereEntwurf } from './entwuerfe.js';

/** Der Schlüssel des Entwurfs der Anhänge zu einem Entwurf. */
export const anhangSchluessel = (schluesselDesEntwurfs) => `anhaenge/${schluesselDesEntwurfs}`;

/**
 * Baut den Anhangsteil eines Formulars. `schluessel` ist der Schlüssel des Texteentwurfs der Ansicht; `gesperrt` sperrt den
 * Knopf (keine Schreibschicht); `verkleinere` verkleinert zu große Bilder. Ergebnis: `platz` (in die Ansicht setzen), `liste()` (die Anhänge für die
 * Schreibschicht), `leer()`.
 */
export async function anhangWahl(k, schluessel, { gesperrt = false, nach = null, verkleinere = verkleinereBild } = {}) {
  const key = anhangSchluessel(schluessel);
  const gemerkt = await liesEntwurf(k.db, key);
  let liste = gemerkt?.anhaenge ?? [];
  const standard = `Bis ${groessenWort(ANHANG_MAX)} je Datei; Fotos verkleinert die App.`;
  const meldung = el('p', { class: 'neben', role: 'status' }, standard);
  const zeilen = el('ul', { class: 'gewaehlt' });
  const eingabe = el('input', { type: 'file', multiple: true, hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
  const sichern = () => speichereEntwurf(k.db, key, { anhaenge: liste }, liste.length === 0, k.jetzt());

  const zeichne = () => {
    zeilen.replaceChildren(...liste.map((a) => {
      const weg = knopf('Entfernen', { klasse: 'text', an: () => { liste = liste.filter((x) => x !== a); meldung.textContent = `${a.name} ist entfernt.`; zeichne(); sichern(); } });
      weg.setAttribute('aria-label', `${a.name} entfernen`);
      return el('li', {}, el('span', { class: 'gewaehlt-name' }, el('b', {}, a.name), el('span', {}, a.vorher ? `verkleinert von ${groessenWort(a.vorher)} auf ${groessenWort(a.groesse)}` : groessenWort(a.groesse))), weg);
    }));
    nach?.(liste);
  };

  eingabe.addEventListener('change', async () => {
    const hinweise_ = [];
    const fehler_ = [];
    const gewaehlt = [...(eingabe.files ?? [])];
    // Sofort sagen, dass geladen wird: das Lesen und Umwandeln großer Dateien dauert
    if (gewaehlt.length) {
      meldung.textContent = gewaehlt.length === 1 ? `${gewaehlt[0].name} wird geladen …` : `${gewaehlt.length} Dateien werden geladen …`;
      meldung.setAttribute('class', 'neben');
    }
    for (const f of gewaehlt) {
      if (f.size <= BILD_QUELLE_MAX && wirdUmkodiert(f.name, f.type, f.size)) { meldung.textContent = `${f.name} wird verkleinert …`; meldung.setAttribute('class', 'neben'); }
      let b;
      try { b = await bereiteVor({ name: f.name, typ: f.type, groesse: f.size, blob: f }, verkleinere); } catch { fehler_.push(`${f.name} lässt sich nicht lesen. Wähle sie noch einmal.`); continue; }
      if (!b.ok) { fehler_.push(b.fehler); continue; }
      const r = nimmAuf(liste, { name: b.name, groesse: b.groesse, typ: b.typ, daten: b.daten, vorher: b.vorher });
      if (r.ok) { liste = r.liste; if (r.hinweis) hinweise_.push(r.hinweis); } else fehler_.push(r.fehler);
    }
    eingabe.value = '';
    meldung.textContent = [...fehler_, ...hinweise_].join(' ') || standard;
    meldung.setAttribute('class', fehler_.length ? 'neben fehler' : 'neben');
    zeichne();
    sichern();
  });

  const waehlen = knopf('Datei anhängen', { klasse: 'tonal', symbol: 'attach_file', gesperrt, an: () => eingabe.click() });
  const platz = el('div', { class: 'anhangwahl' }, waehlen, eingabe, zeilen, meldung);
  zeichne();
  return { platz, liste: () => liste, leer: () => { liste = []; zeichne(); return sichern(); } };
}
