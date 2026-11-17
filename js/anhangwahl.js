// Dateien anhängen: der Knopf „Datei anhängen“ öffnet die Dateiauswahl des Systems (in der Android-Hülle über deren
// Dateiauswahl), darunter steht die Liste der gewählten Dateien mit Größe und Entfernen. Die Dateien liegen als Base64 im
// Entwurf `anhaenge/SCHLÜSSEL` auf dem Gerät, damit Zurück, Neuladen und das Beenden der App sie nicht kosten. Prüfen und
// Annehmen macht anhaenge.js (nimmAuf): zu groß, doppelter Name, Hinweis über 300 KiB.
import { el } from './dom.js';
import { ANHANG_MAX, bytesZuBasis, groessenWort, nimmAuf } from './anhaenge.js';
import { knopf } from './karten.js';
import { liesEntwurf, speichereEntwurf } from './entwuerfe.js';

/** Der Schlüssel des Entwurfs der Anhänge zu einem Entwurf. */
export const anhangSchluessel = (schluesselDesEntwurfs) => `anhaenge/${schluesselDesEntwurfs}`;

/**
 * Baut den Anhangsteil eines Formulars. `schluessel` ist der Schlüssel des Texteentwurfs der Ansicht; `gesperrt` sperrt den
 * Knopf (keine Schreibschicht). Ergebnis: `platz` (in die Ansicht setzen), `liste()` (die Anhänge für die Schreibschicht),
 * `leer()`.
 */
export async function anhangWahl(k, schluessel, { gesperrt = false, nach = null } = {}) {
  const key = anhangSchluessel(schluessel);
  const gemerkt = await liesEntwurf(k.db, key);
  let liste = gemerkt?.anhaenge ?? [];
  // Was beim Teilen aus einer anderen App abgelehnt wurde (huelle.js, mitGeteiltenDateien), steht einmal als Satz da
  const geteilt = typeof gemerkt?.meldung === 'string' && gemerkt.meldung !== '' ? gemerkt : null;
  const meldung = el('p', { class: geteilt?.meldungFehler ? 'neben fehler' : 'neben', role: 'status' }, geteilt?.meldung ?? `Bis ${groessenWort(ANHANG_MAX)} je Datei.`);
  const zeilen = el('ul', { class: 'gewaehlt' });
  const eingabe = el('input', { type: 'file', multiple: true, hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
  const sichern = () => speichereEntwurf(k.db, key, { anhaenge: liste }, liste.length === 0, k.jetzt());

  const zeichne = () => {
    zeilen.replaceChildren(...liste.map((a) => {
      const weg = knopf('Entfernen', { klasse: 'text', an: () => { liste = liste.filter((x) => x !== a); meldung.textContent = `${a.name} ist entfernt.`; zeichne(); sichern(); } });
      weg.setAttribute('aria-label', `${a.name} entfernen`);
      return el('li', {}, el('span', { class: 'gewaehlt-name' }, el('b', {}, a.name), el('span', {}, groessenWort(a.groesse))), weg);
    }));
    nach?.(liste);
  };

  eingabe.addEventListener('change', async () => {
    const hinweise = [];
    const fehler = [];
    const gewaehlt = [...(eingabe.files ?? [])];
    // Sofort sagen, dass geladen wird: das Lesen und Umwandeln großer Dateien dauert
    if (gewaehlt.length) {
      meldung.textContent = gewaehlt.length === 1 ? `${gewaehlt[0].name} wird geladen …` : `${gewaehlt.length} Dateien werden geladen …`;
      meldung.setAttribute('class', 'neben');
    }
    for (const f of gewaehlt) {
      if (f.size > ANHANG_MAX) { fehler.push(`${f.name} ist ${groessenWort(f.size)} groß; erlaubt sind höchstens ${groessenWort(ANHANG_MAX)}. Verkleinere die Datei und wähle sie noch einmal.`); continue; }
      let daten;
      try { daten = bytesZuBasis(new Uint8Array(await f.arrayBuffer())); } catch { fehler.push(`${f.name} lässt sich nicht lesen. Wähle sie noch einmal.`); continue; }
      const r = nimmAuf(liste, { name: f.name, groesse: f.size, typ: f.type, daten });
      if (r.ok) { liste = r.liste; if (r.hinweis) hinweise.push(r.hinweis); } else fehler.push(r.fehler);
    }
    eingabe.value = '';
    meldung.textContent = [...fehler, ...hinweise].join(' ') || `Bis ${groessenWort(ANHANG_MAX)} je Datei.`;
    meldung.setAttribute('class', fehler.length ? 'neben fehler' : 'neben');
    zeichne();
    sichern();
  });

  const waehlen = knopf('Datei anhängen', { klasse: 'tonal', symbol: 'attach_file', gesperrt, an: () => eingabe.click() });
  const platz = el('div', { class: 'anhangwahl' }, waehlen, eingabe, zeilen, meldung);
  zeichne();
  if (geteilt) {
    sichern();   // die Meldung kommt nicht wieder, die Dateien bleiben
    // Ein Satz zu einer abgelehnten Datei steht sonst unter dem Rand des Bildschirms; die Ansicht setzt `platz` erst nach diesem Aufruf ein
    if (geteilt.meldungFehler) setTimeout(() => platz.scrollIntoView?.({ block: 'center' }), 150);
  }
  return { platz, liste: () => liste, leer: () => { liste = []; zeichne(); return sichern(); } };
}
