// Anmelden: Repo, Token, Name des Geräts und das Ablaufdatum des Tokens. Das Token steht nie in einer Adresse, einem Log
// oder einer Anzeige; es liegt in IndexedDB (speicher.js, Einstellung „anmeldung“) und im Feld nur als Punkte (type=password).
// Dieselbe Ansicht ersetzt später ein Token („Token ersetzen“) und schreibt „Neues Token eintragen“ nach einem Ablauf.
import { el } from './dom.js';
import { feld, knopf } from './karten.js';
import { GERAET_VORGABE, pruefeGeraet, pruefeRepo, pruefeToken, ablaufEnde } from './anmeldung.js';
import { einstellung, setzeEinstellung } from './speicher.js';

/** Liest die gespeicherte Anmeldung und den Gerätenamen für Vorbelegung und Mehr. */
export async function ladeAnmeldung(db) {
  const a = await einstellung(db, 'anmeldung');
  return { repo: a?.repo ?? null, token: Boolean(a?.token), ablauf: a?.ablauf ?? null, geraet: (await einstellung(db, 'geraet')) ?? null };
}

/** Der Name des Geräts, wie er in gesendeten Einträgen steht; vor der Anmeldung die Vorgabe. */
export async function geraetName(db) {
  return (await einstellung(db, 'geraet')) ?? GERAET_VORGABE;
}

const schritte = () => el('details', { open: true }, el('summary', {}, 'So erstellst du das Token'), el('ol', { class: 'ablauf-schritte' },
  el('li', {}, 'Öffne in GitHub ', el('strong', {}, 'Settings'), ', dann ', el('strong', {}, 'Developer settings'), ', ', el('strong', {}, 'Personal access tokens'), ' und ', el('strong', {}, 'Fine-grained tokens'), '. Wähle ', el('strong', {}, 'Generate new token'), '.'),
  el('li', {}, 'Wähle unter ', el('strong', {}, 'Repository access'), ' den Eintrag ', el('strong', {}, 'Only select repositories'), ' und dann dein Repo mit den Einträgen.'),
  el('li', {}, 'Wähle unter ', el('strong', {}, 'Permissions'), ' den Eintrag ', el('strong', {}, 'Contents'), ' mit ', el('strong', {}, 'Read and write'), '.'),
  el('li', {}, 'Wähle unter ', el('strong', {}, 'Expiration'), ' den Eintrag ', el('strong', {}, 'Custom'), ' und ein Datum in einem Jahr.'),
  el('li', {}, 'Wähle ', el('strong', {}, 'Generate token'), ' und kopiere es.')));

/** Die Ansicht Anmelden; `fertig()` ruft die Navigation nach dem Speichern. */
export async function anmeldenAnsicht(k, { fertig }) {
  const alt = await ladeAnmeldung(k.db);
  const werte = { repo: alt.repo ?? '', token: '', geraet: alt.geraet ?? GERAET_VORGABE, ablauf: alt.ablauf ?? '' };
  const fehler = {};
  const form = el('form', { id: 'anmelden-formular', autocomplete: 'off' });
  const zeichne = () => {
    const eingabe = (name, typ, attr = {}) => {
      const i = el('input', { type: typ, name, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-invalid': fehler[name] ? 'true' : false, ...attr });
      i.value = werte[name];
      i.addEventListener('input', () => { werte[name] = i.value; });
      return i;
    };
    const geraetFehler = fehler.geraet;
    form.replaceChildren(
      feld({ beschriftung: 'Repo', steuerung: eingabe('repo', 'text', { placeholder: 'EIGENTÜMER/NAME', inputmode: 'url' }), hinweis: 'Das private Repo, in dem deine Einträge liegen.', fehler: fehler.repo }),
      feld({ beschriftung: 'Token', steuerung: eingabe('token', 'password'), hinweis: 'Du fügst es ein; es erscheint nicht im Klartext.', fehler: fehler.token }),
      feld({
        beschriftung: 'Name dieses Geräts', steuerung: eingabe('geraet', 'text'), fehler: geraetFehler?.fehler,
        hinweis: `Er steht in jedem Eintrag, den dieses Gerät sendet, und in Abnahmen für host:${geraetFehler?.vorschlag ?? (werte.geraet || GERAET_VORGABE)}. Erlaubt: Kleinbuchstaben, Ziffern, Bindestrich.`,
      }),
      geraetFehler?.vorschlag ? knopf(`${geraetFehler.vorschlag} übernehmen`, { klasse: 'text', an: () => { werte.geraet = geraetFehler.vorschlag; delete fehler.geraet; zeichne(); } }) : null,
      feld({ beschriftung: 'Läuft ab am (freiwillig)', steuerung: eingabe('ablauf', 'date'), hinweis: 'Damit warnt dich die App 14 Tage vorher.', fehler: fehler.ablauf }),
      el('p', { class: 'neben' }, 'Das Token bleibt unverschlüsselt im Speicher dieser App; die Sperre des Handys schützt es.'));
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (const n of Object.keys(fehler)) delete fehler[n];
    const r = pruefeRepo(werte.repo);
    const t = pruefeToken(werte.token);
    const g = pruefeGeraet(werte.geraet);
    if (!r.ok) fehler.repo = r.fehler;
    if (!t.ok) fehler.token = t.fehler;
    if (!g.ok) fehler.geraet = g;
    if (werte.ablauf && ablaufEnde(werte.ablauf) === null) fehler.ablauf = 'Gib das Datum als JJJJ-MM-TT ein.';
    if (Object.keys(fehler).length) {
      zeichne();
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    await setzeEinstellung(k.db, 'anmeldung', { repo: r.repo, token: t.token, ablauf: werte.ablauf || null });
    await setzeEinstellung(k.db, 'geraet', g.name);
    werte.token = '';
    k.steuerung.jetztAbgleichen();
    fertig();
  });
  zeichne();
  return { inhalt: [el('h2', { class: 'titel-gross' }, 'Dieses Gerät mit GitHub verbinden'),
    el('p', {}, 'LLM-Post braucht für dieses Gerät ein Token und einen Namen.'), schritte(), form],
  // Der Knopf klebt unten in Daumenreichweite (UAN-3) und gehört über das Attribut form zum Formular
  aktion: [knopf('Anmelden', { klasse: 'gefuellt', typ: 'submit', id: 'anmelden-knopf', form: 'anmelden-formular' })] };
}
