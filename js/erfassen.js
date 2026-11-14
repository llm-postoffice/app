// Erfassen: ein Eintrag von Hand (Auftrag, Idee, Notiz, Nachricht). Das Formular merkt sich jede Eingabe als Entwurf auf
// dem Gerät (UEI-6). Angelegt wird erst mit der Schreibschicht (Teil E); bis dahin ist der Knopf gesperrt und ein Satz sagt
// warum. Nichts davon täuscht einen Erfolg vor.
import { el } from './dom.js';
import { artVon } from './ansichtstexte.js';
import { auswahl, chipAuswahl, feld, knopf } from './karten.js';
import { liesEntwurf, loescheEntwurf, schluessel, speichereEntwurf } from './entwuerfe.js';
import { kannSenden, SENDEN_FEHLT } from './schreiben.js';

const ARTEN = ['task', 'idea', 'note', 'message'];
const VORGABE = { art: 'task', titel: '', an: '', text: '', rang: '2', dringend: false };

/** Prüft die Eingaben; Ergebnis { ok } oder { fehler: { feld: Satz } }. Der Titel hat 1 bis 120 Zeichen in einer Zeile. */
export function pruefeEintrag(w) {
  const fehler = {};
  const titel = String(w.titel ?? '').trim();
  if (!titel) fehler.titel = 'Gib einen Titel ein.';
  else if (titel.length > 120) fehler.titel = `Der Titel hat ${titel.length} Zeichen; erlaubt sind höchstens 120.`;
  else if (/[\r\n]/.test(titel)) fehler.titel = 'Der Titel steht in einer Zeile.';
  return Object.keys(fehler).length ? { fehler } : { ok: true };
}

/** Ob der Entwurf noch der Vorgabe entspricht; dann wird er gelöscht. */
export const istLeer = (w) => !w.titel.trim() && !w.text.trim() && !w.an && w.art === VORGABE.art && w.rang === VORGABE.rang && !w.dringend;

/** Die Ansicht Erfassen und ihre Aktionsleiste. */
export async function erfassenAnsicht(welt, _z, k) {
  const w = { ...VORGABE, ...((await liesEntwurf(k.db, schluessel.erfassen)) ?? {}) };
  delete w.schluessel; delete w.zeit;
  const sichern = () => speichereEntwurf(k.db, schluessel.erfassen, { ...w }, istLeer(w), k.jetzt());
  const titelFeld = (fehler) => {
    const i = el('input', { type: 'text', name: 'titel', autocomplete: 'off', autocapitalize: 'sentences', maxlength: 200, placeholder: 'Ein Satz, der sagt, worum es geht', 'aria-invalid': fehler ? 'true' : false });
    i.value = w.titel;
    i.addEventListener('input', () => { w.titel = i.value; sichern(); });
    return feld({ beschriftung: 'Titel', steuerung: i, fehler });
  };
  let titel = titelFeld(null);
  const an = auswahl({
    name: 'an', wert: w.an,
    gruppen: [{ titel: 'Eingang', optionen: [{ wert: '', text: 'Eingang, ich sortiere später' }] },
      ...(welt.projektNamen.length ? [{ titel: `Projekte (${welt.projektNamen.length})`, optionen: welt.projektNamen.map((p) => ({ wert: p, text: p })) }] : [])],
  });
  an.addEventListener('change', () => { w.an = an.value; sichern(); });
  const text = el('textarea', { name: 'text', rows: 3, autocapitalize: 'sentences' });
  text.value = w.text;
  text.addEventListener('input', () => { w.text = text.value; sichern(); });
  const arten = chipAuswahl({
    name: 'art', arten: true, wert: w.art,
    optionen: ARTEN.map((a) => ({ wert: a, klasse: artVon(a).klasse, symbol: artVon(a).symbol, text: artVon(a).wort })),
  });
  arten.addEventListener('change', (e) => { w.art = e.target.value; sichern(); });
  const rang = chipAuswahl({ name: 'rang', wert: w.rang, optionen: ['1', '2', '3'].map((r) => ({ wert: r, text: r })) });
  rang.addEventListener('change', (e) => { w.rang = e.target.value; sichern(); });
  const dringend = el('input', { type: 'checkbox', name: 'dringend' });
  dringend.checked = w.dringend;
  dringend.addEventListener('change', () => { w.dringend = dringend.checked; sichern(); });

  const inhalt = el('form', { id: 'erfassen-formular' },
    el('p', {}, 'Halte fest, was Claude tun oder wissen soll. Der Eintrag geht beim nächsten Abgleich mit.'),
    el('fieldset', { class: 'feld' }, el('legend', {}, 'Art'), arten),
    titel,
    feld({ beschriftung: 'An', steuerung: an, hinweis: welt.projektNamen.length ? null : 'Projekte fehlen noch. Gleiche in Mehr ab.' }),
    feld({ beschriftung: 'Text (freiwillig)', steuerung: text }),
    el('fieldset', { class: 'feld' }, el('legend', {}, 'Rang (1 ist am wichtigsten)'), rang),
    el('label', { class: 'haken' }, dringend, 'Dringend: meldet auch zwischen 22 und 7 Uhr'));
  inhalt.addEventListener('submit', (e) => e.preventDefault());

  const gesperrt = !kannSenden(k);
  const anlegen = knopf('Eintrag anlegen', { klasse: 'gefuellt', gesperrt, an: async () => {
    const p = pruefeEintrag(w);
    if (!p.ok) {
      const neu = titelFeld(p.fehler.titel);
      titel.replaceWith(neu); titel = neu;
      neu.querySelector('input').focus();
      return;
    }
    await k.schreiben.anlegen({ art: w.art, titel: w.titel.trim(), an: w.an || null, text: w.text.trim(), rang: Number(w.rang), dringend: w.dringend });
    await loescheEntwurf(k.db, schluessel.erfassen);
    k.neuZeichnen();
  } });
  anlegen.dataset.handlung = 'anlegen';
  return { inhalt: [inhalt], aktion: gesperrt ? [anlegen, el('p', { class: 'neben satz' }, SENDEN_FEHLT)] : [anlegen] };
}
