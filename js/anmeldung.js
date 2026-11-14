// Anmeldung: Eingaben prüfen und das Ablaufdatum des Tokens in Worte fassen. Reine Funktionen ohne Browser, damit
// node --test sie prüft. Repo, Name des Geräts und Token trägt der Nutzer ein; im Code steht kein Name davon. Das Token
// liegt in IndexedDB (speicher.js, Einstellung „anmeldung“) und steht nie in einer Adresse, einem Log oder einer Anzeige.

/** Vorbelegung des Gerätenamens: ein neutrales Wort; der Nutzer ändert es auf den Namen seines Geräts. */
export const GERAET_VORGABE = 'handy';
/** So viele Tage vor dem Ablauf warnt die App (E7). */
export const WARNUNG_TAGE = 14;

const GERAET_RE = /^[a-z0-9][a-z0-9-]*$/;
const REPO_RE = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;

/** Macht aus einer Eingabe einen erlaubten Namen: klein, Leerzeichen und Unterstriche zu Strichen, Rest fällt weg. */
export function geraetVorschlag(roh) {
  return String(roh ?? '').trim().toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Prüft den Namen des Geräts; er steht in `From` jedes gesendeten Eintrags und in Abnahmen für `host:NAME`
 * (Kleinbuchstaben, Ziffern und Bindestrich, vorn ein Buchstabe oder eine Ziffer). Ergebnis: { ok, name } oder
 * { ok: false, fehler, vorschlag }.
 */
export function pruefeGeraet(roh) {
  const name = String(roh ?? '').trim();
  if (!name) return { ok: false, fehler: 'Gib einen Namen ein.', vorschlag: null };
  if (GERAET_RE.test(name)) return { ok: true, name };
  const vorschlag = geraetVorschlag(name) || null;
  const fehler = /[A-Z\s]/.test(name) && !/[^A-Za-z0-9\s-]/.test(name)
    ? 'Der Name darf keine Großbuchstaben und keine Leerzeichen enthalten.'
    : 'Der Name darf nur Kleinbuchstaben, Ziffern und Bindestrich enthalten und beginnt mit einem Buchstaben oder einer Ziffer.';
  return { ok: false, fehler, vorschlag };
}

/** Prüft „EIGENTÜMER/NAME“; eine kopierte GitHub-Adresse wird gekürzt. */
export function pruefeRepo(roh) {
  let text = String(roh ?? '').trim().replace(/^https:\/\/github\.com\//i, '').replace(/\/+$/, '');
  text = text.replace(/\/(tree|blob)\/.*$/, '').replace(/\.git$/, '');
  if (!text) return { ok: false, fehler: 'Gib das Repo ein, in dem deine Einträge liegen.' };
  if (!REPO_RE.test(text)) return { ok: false, fehler: 'Das Repo besteht aus Eigentümer und Name, getrennt durch einen Schrägstrich: EIGENTÜMER/NAME.' };
  return { ok: true, repo: text };
}

/** Das Token darf nicht leer sein und keine Leerzeichen enthalten (beim Einfügen kommt oft ein Zeilenumbruch mit). */
export function pruefeToken(roh) {
  const token = String(roh ?? '').trim();
  if (!token) return { ok: false, fehler: 'Füge das Token ein.' };
  if (/\s/.test(token)) return { ok: false, fehler: 'Das Token enthält ein Leerzeichen. Füge es noch einmal ein.' };
  return { ok: true, token };
}

/** Ein Datum der Form JJJJ-MM-TT; das Token gilt bis zum Ende dieses Tages (Ortszeit). */
export function ablaufEnde(datum) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d.getTime();
}

/**
 * Wann läuft das Token ab? Ohne Datum gibt es keine Warnung (E7). Ergebnis: { text, warnung, abgelaufen } oder null.
 * Der Text nennt Datum und Tage; „in 1 Tag“, „heute“.
 */
export function ablaufAnzeige(datum, jetzt) {
  const ende = ablaufEnde(datum);
  if (ende === null) return null;
  if (ende < jetzt) return { text: `Es ist am ${datum} abgelaufen.`, warnung: true, abgelaufen: true };
  const heute = new Date(jetzt);
  const tage = Math.round((new Date(new Date(ende).getFullYear(), new Date(ende).getMonth(), new Date(ende).getDate()) - new Date(heute.getFullYear(), heute.getMonth(), heute.getDate())) / 86400000);
  const wann = tage <= 0 ? 'heute' : tage === 1 ? 'in 1 Tag' : `in ${tage} Tagen`;
  return { text: `Es läuft am ${datum} ab, ${wann}.`, warnung: tage <= WARNUNG_TAGE, abgelaufen: false, tage };
}
