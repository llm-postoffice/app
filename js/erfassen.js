// Erfassen: ein Eintrag von Hand (Auftrag, Idee, Notiz, Nachricht). Das Formular merkt sich jede Eingabe als Entwurf auf
// dem Gerät (UEI-6). **Eintrag anlegen** reiht den Eintrag über die Schreibschicht ein (schreiben.js): Titel und Text gehen
// vorher durch die Prüfung auf Geheimnisse und Personendaten, der Hinweis bietet zehn Sekunden Rückgängig an, danach geht er
// raus. Fehlt die Schreibschicht (Tests), ist der Knopf gesperrt und ein Satz sagt warum.
import { el } from './dom.js';
import { artVon } from './ansichtstexte.js';
import { auswahl, chipAuswahl, feld, knopf } from './karten.js';
import { liesEntwurf, schluessel, speichereEntwurf } from './entwuerfe.js';
import { kannSenden, SENDEN_FEHLT } from './schreiben.js';
import { absender } from './absenden.js';
import { anhangWahl } from './anhangwahl.js';

const ARTEN = ['task', 'idea', 'note', 'message'];
const VORGABE = { art: 'task', titel: '', an: '', text: '', rang: '2', dringend: false };

/** Prüft die Eingaben; Ergebnis { ok } oder { fehler: { feld: Satz } }. Der Titel hat 1 bis 120 Zeichen in einer Zeile, eine Nachricht braucht einen Text. */
export function pruefeEintrag(w) {
  const fehler = {};
  const titel = String(w.titel ?? '').trim();
  if (!titel) fehler.titel = 'Gib einen Titel ein.';
  else if (titel.length > 120) fehler.titel = `Der Titel hat ${titel.length} Zeichen; erlaubt sind höchstens 120.`;
  else if (/[\r\n]/.test(titel)) fehler.titel = 'Der Titel steht in einer Zeile.';
  if (w.art === 'message' && !String(w.text ?? '').trim()) fehler.text = 'Eine Nachricht braucht einen Text.';
  return Object.keys(fehler).length ? { fehler } : { ok: true };
}

/** Ob der Entwurf noch der Vorgabe entspricht; dann wird er gelöscht. */
export const istLeer = (w) => !w.titel.trim() && !w.text.trim() && !w.an && w.art === VORGABE.art && w.rang === VORGABE.rang && !w.dringend;

/** Die Ansicht Erfassen und ihre Aktionsleiste. */
export async function erfassenAnsicht(welt, _z, k) {
  const w = { ...VORGABE, ...((await liesEntwurf(k.db, schluessel.erfassen)) ?? {}) };
  delete w.schluessel; delete w.zeit;
  // Entwurf verwerfen: der Knopf steht rechts von Anlegen und nur da, wo etwas im Entwurf steht (Text, Wahl oder Anhänge)
  let angehaengt = 0;
  const verwerfen = knopf('Entwurf verwerfen', { klasse: 'text', gesperrt: !kannSenden(k), an: async () => { globalThis.document?.activeElement?.blur?.(); await k.schreiben.verwirfEntwurf(schluessel.erfassen); } });
  verwerfen.dataset.handlung = 'entwurf-verwerfen';
  const zeigeVerwerfen = () => { verwerfen.hidden = istLeer(w) && !angehaengt; };
  zeigeVerwerfen();
  const sichern = () => { zeigeVerwerfen(); return speichereEntwurf(k.db, schluessel.erfassen, { ...w }, istLeer(w), k.jetzt()); };
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
      { titel: 'An dich', optionen: [{ wert: 'user', text: 'An dich (Ideensammlung)' }] },
      ...(welt.projektNamen.length ? [{ titel: `Projekte (${welt.projektNamen.length})`, optionen: welt.projektNamen.map((p) => ({ wert: p, text: p })) }] : [])],
  });
  an.addEventListener('change', () => { w.an = an.value; sichern(); });
  const textFeld = (fehler) => {
    const t = el('textarea', { name: 'text', rows: 3, autocapitalize: 'sentences', 'aria-invalid': fehler ? 'true' : false });
    t.value = w.text;
    t.addEventListener('input', () => { w.text = t.value; sichern(); });
    return feld({ beschriftung: w.art === 'message' ? 'Text' : 'Text (freiwillig)', steuerung: t, fehler });
  };
  let text = textFeld(null);
  const arten = chipAuswahl({
    name: 'art', arten: true, wert: w.art,
    optionen: ARTEN.map((a) => ({ wert: a, klasse: artVon(a).klasse, symbol: artVon(a).symbol, text: artVon(a).wort })),
  });
  arten.addEventListener('change', (e) => {
    w.art = e.target.value;
    // Eine Idee ohne Adresse läge im Eingang statt in der Ideensammlung (N3): bei Idee ist An dich vorbelegt
    if (w.art === 'idea' && !w.an) { w.an = 'user'; an.value = 'user'; } else if (w.art !== 'idea' && w.an === 'user') { w.an = ''; an.value = ''; }
    const neu = textFeld(null); text.replaceWith(neu); text = neu;   // die Beschriftung sagt, ob der Text Pflicht ist
    sichern();
  });
  const rang = chipAuswahl({ name: 'rang', wert: w.rang, optionen: [['1', 'Hoch'], ['2', 'Normal'], ['3', 'Niedrig']].map(([wert, text]) => ({ wert, text })) });
  rang.addEventListener('change', (e) => { w.rang = e.target.value; sichern(); });
  const dringend = el('input', { type: 'checkbox', name: 'dringend' });
  dringend.checked = w.dringend;
  dringend.addEventListener('change', () => { w.dringend = dringend.checked; sichern(); });

  const anhang = await anhangWahl(k, schluessel.erfassen, { gesperrt: !kannSenden(k), nach: (liste) => { angehaengt = liste.length; zeigeVerwerfen(); } });

  // Eine Ablehnung steht oben im Formular, damit sie ohne Suchen im Blick ist
  const { platz: ablehnung, los } = absender(
    (opt) => k.schreiben.anlegen({ art: w.art, titel: w.titel.trim(), an: w.an || null, text: w.text.trim(), rang: Number(w.rang), dringend: w.dringend, anhaenge: anhang.liste(),
      entwurf: { schluessel: schluessel.erfassen, wert: { ...w } }, ...opt }),
    () => k.neuZeichnen());
  const inhalt = el('form', { id: 'erfassen-formular' },
    el('p', {}, 'Halte fest, was Claude tun oder wissen soll. Nach dem Anlegen kannst du den Eintrag zehn Sekunden lang zurücknehmen, danach geht er raus.'),
    ablehnung,
    el('fieldset', { class: 'feld' }, el('legend', {}, 'Art'), arten),
    titel,
    feld({ beschriftung: 'An', steuerung: an, hinweis: welt.projektNamen.length ? null : 'Projekte fehlen noch. Gleiche in Mehr ab.' }),
    text,
    anhang.platz,
    el('fieldset', { class: 'feld' }, el('legend', {}, 'Priorität'), rang),
    el('label', { class: 'haken' }, dringend, 'Dringend: meldet auch zwischen 22 und 7 Uhr'));
  inhalt.addEventListener('submit', (e) => e.preventDefault());

  const gesperrt = !kannSenden(k);
  const anlegen = knopf('Eintrag anlegen', { klasse: 'gefuellt', gesperrt, an: async (ev) => {
    const p = pruefeEintrag(w);
    if (!p.ok) {
      ablehnung.replaceChildren();
      if (p.fehler.titel) { const neu = titelFeld(p.fehler.titel); titel.replaceWith(neu); titel = neu; neu.querySelector('input').focus(); }
      if (p.fehler.text) { const neu = textFeld(p.fehler.text); text.replaceWith(neu); text = neu; if (!p.fehler.titel) neu.querySelector('textarea').focus(); }
      return;
    }
    await los(false, ev.currentTarget);
  } });
  anlegen.dataset.handlung = 'anlegen';
  return { inhalt: [inhalt], aktion: gesperrt ? [anlegen, verwerfen, el('p', { class: 'neben satz' }, SENDEN_FEHLT)] : [anlegen, verwerfen] };
}
