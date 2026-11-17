// Der Abschnitt „Anhänge“ am Ende eines Eintrags: je Anhang eine Zeile mit Symbol, Name, Größe, Art und Herkunft; ein Tipp
// klappt die Zeile auf. Bilder (Rasterformate) und Text zeigt die App selbst, alles andere liegt zum Herunterladen bereit.
// Den Inhalt lädt `k.anhaenge` (anhangholer.js) erst beim Aufklappen und hält ihn danach auf dem Gerät. Gebaut nur mit el()
// und ico(); Namen und Text stehen als Text im Baum, nie als HTML. Herunterladen: im Browser ein Link auf einen Blob, in der
// Android-Hülle die Nachricht `speichern` (Protokoll im Kopf von js/huelle.js).
import { el, ico } from './dom.js';
import { anhaengeVon, artWort, basisZuBytes, dataAdresse, groessenWort, textVon, ANHANG_MAX } from './anhaenge.js';
import { zeitpunkt } from './ansichtstexte.js';
import { band, knopf, linkKnopf } from './karten.js';

const symbolVon = (art) => (art === 'bild' ? ico('image-f') : art === 'text' ? ico('description-f') : ico('draft-f'));
/** So viele Zeichen eines Textes zeigt die App; den Rest gibt es mit Herunterladen. */
export const TEXT_ANZEIGE_MAX = 100_000;
/** So lange wartet die Seite auf den Speichern-Dialog der Hülle. */
export const SPEICHERN_WARTEZEIT_MS = 10 * 60 * 1000;

// Geöffnete Zeilen (nach Pfad) bleiben offen, wenn die Ansicht neu gezeichnet wird, etwa nach einem Abgleich
const offene = new Set();

/** Speichert die Datei: Hülle oder Browser. Ergebnis 'ok', 'abgebrochen' oder 'fehler'. */
export async function speichereAnhang(k, a, daten) {
  if (k.huelle) {
    try {
      const r = await k.huelle.frage('speichern', { name: a.name, typ: a.typ, daten }, SPEICHERN_WARTEZEIT_MS);
      return r?.art === 'ok' ? 'ok' : r?.art === 'abgebrochen' ? 'abgebrochen' : 'fehler';
    } catch { return 'fehler'; }
  }
  try {
    const adresse = URL.createObjectURL(new Blob([basisZuBytes(daten)], { type: a.typ }));
    const link = el('a', { href: adresse, download: a.name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(adresse), 10_000);
    return 'ok';
  } catch { return 'fehler'; }
}

const GESPEICHERT = { ok: (k) => (k.huelle ? 'Gespeichert.' : 'Heruntergeladen.'), abgebrochen: () => 'Nicht gespeichert.', fehler: () => 'Speichern ging nicht. Versuche es noch einmal.' };

function fehlerBand(a, e, nochmal) {
  const erneut = knopf('Erneut versuchen', { an: nochmal });
  if (e.art === 'zu-gross') return band({ ton: 'info', symbol: 'info-f', titel: 'Zu groß für die App', satz: `Der Anhang ist ${groessenWort(a.groesse)} groß, die App lädt höchstens ${groessenWort(ANHANG_MAX)}. Hol ihn am Rechner.` });
  if (e.art === 'netz') return band({ ton: 'info', symbol: 'cloud_off-f', titel: 'Ohne Netz', satz: 'Dieser Anhang war noch nie auf diesem Gerät. Öffne ihn einmal mit Netz, danach bleibt er hier.', knoepfe: [erneut] });
  if (e.art === 'token' || e.art === 'anmeldung') return band({ ton: 'warn', symbol: 'key-f', titel: e.art === 'token' ? 'Token abgelaufen oder widerrufen' : 'Nicht angemeldet', satz: 'Ohne gültiges Token lädt die App den Anhang nicht.', knoepfe: [linkKnopf('Neues Token eintragen', '#anmelden')] });
  if (e.art === 'limit') return band({ ton: 'warn', symbol: 'warning-f', titel: 'GitHub bremst', satz: 'GitHub nimmt gerade keine weiteren Anfragen an. Versuche es in einigen Minuten noch einmal.', knoepfe: [erneut] });
  const satz = e.art === 'nicht-gefunden' ? 'GitHub findet den Anhang nicht. Gleiche in Mehr ab und versuche es noch einmal.'
    : e.art === 'verboten' ? 'GitHub erlaubt dem Token diesen Zugriff nicht. Trage in Mehr ein Token mit Leserecht auf das Repo ein.'
      : `GitHub antwortet mit Status ${e.status ?? '?'}. Versuche es später noch einmal.`;
  return band({ ton: 'fehler', symbol: 'error-f', titel: 'Anhang nicht geladen', satz, knoepfe: [erneut] });
}

/** Der Inhalt einer aufgeklappten Zeile, wenn der Anhang da ist. */
function inhaltVon(a, daten, k) {
  const bytes = basisZuBytes(daten);
  const teile = [];
  let art = a.art;
  const meldung = el('p', { class: 'neben', role: 'status' }, '');
  if (art === 'text') {
    const text = textVon(bytes);
    if (text === null) art = 'datei';
    else {
      const zeigt = text.length > TEXT_ANZEIGE_MAX ? text.slice(0, TEXT_ANZEIGE_MAX) : text;
      teile.push(el('pre', { class: 'anhang-text' }, zeigt));
      if (zeigt !== text) teile.push(el('p', { class: 'neben' }, `Gekürzt: die ersten ${TEXT_ANZEIGE_MAX.toLocaleString('de-DE')} Zeichen. Den Rest hast du in der heruntergeladenen Datei.`));
    }
  }
  if (art === 'bild') {
    const bild = el('img', { class: 'anhang-bild', src: dataAdresse(a.typ, daten), alt: a.name });
    bild.addEventListener('error', () => bild.replaceWith(el('p', { class: 'neben' }, 'Das Bild lässt sich nicht anzeigen. Lade es herunter und öffne es in einer anderen App.')));
    teile.push(bild);
  }
  if (art === 'datei') teile.push(el('p', { class: 'neben' }, a.art === 'text' ? 'Die Datei ist kein Text. Lade sie herunter, um sie zu öffnen.' : 'Diesen Typ zeigt die App nicht an. Lade die Datei herunter, um sie zu öffnen.'));
  const laden = knopf('Herunterladen', { klasse: art === 'datei' ? 'tonal' : 'text', symbol: 'download' });
  laden.addEventListener('click', async () => {
    laden.disabled = true;
    const r = await speichereAnhang(k, a, daten);
    meldung.textContent = GESPEICHERT[r](k);
    laden.disabled = false;
  });
  teile.push(el('div', { class: 'zeilenknoepfe' }, laden), meldung);
  return teile;
}

function zeile(welt, a, k) {
  const woher = a.ulid ? `vom Nachtrag von ${zeitpunkt(a.zeit, welt.jetzt)}` : 'vom Eintrag';
  const kopf = el('button', { type: 'button', class: 'anhang-kopf', 'aria-expanded': 'false' },
    el('span', { class: 'anhang-sym' }, symbolVon(a.art)),
    el('span', { class: 'anhang-name' }, el('b', {}, a.name), el('span', {}, `${groessenWort(a.groesse)} · ${artWort(a.name)} · ${woher}`)),
    ico('expand_more', 'anhang-pfeil'));
  const inhalt = el('div', { class: 'anhang-inhalt', hidden: true });
  const li = el('li', { class: 'anhang' }, kopf, inhalt);
  const laden = async () => {
    inhalt.replaceChildren(el('p', { class: 'neben', role: 'status' }, 'Anhang wird geladen'));
    const r = (await k.anhaenge?.inhalt(a)) ?? { ok: false, art: 'netz' };
    inhalt.replaceChildren(...(r.ok ? inhaltVon(a, r.daten, k) : [fehlerBand(a, r, laden)]));
  };
  const auf = (an) => {
    li.setAttribute('class', an ? 'anhang offen' : 'anhang');
    kopf.setAttribute('aria-expanded', String(an));
    inhalt.hidden = !an;
    if (an) offene.add(a.pfad); else offene.delete(a.pfad);
  };
  kopf.addEventListener('click', () => {
    if (kopf.getAttribute('aria-expanded') === 'true') { auf(false); return; }
    auf(true);
    return laden();
  });
  if (offene.has(a.pfad)) { auf(true); laden(); }
  return li;
}

/** Der Abschnitt für einen Eintrag: Überschrift mit Zahl und die Zeilen; nichts, wenn es keine Anhänge gibt. */
export function anhaengeAbschnitt(welt, e, k) {
  const liste = anhaengeVon(welt.baum, e);
  if (!liste.length) return [];
  return [el('h2', {}, `Anhänge (${liste.length})`), el('ul', { class: 'anhaenge' }, liste.map((a) => zeile(welt, a, k)))];
}
