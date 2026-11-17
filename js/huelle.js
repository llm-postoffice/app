// Brücke zur Android-Hülle. Die Hülle (Kotlin, WebView) legt vor dem ersten Skript der Seite ein Objekt `llmpost` an, nur
// für die Herkunft appassets.androidplatform.net und nur im Hauptframe. Es hat postMessage(text) und ruft onmessage({ data }).
// Im Browser fehlt es; dann bleibt alles, wie es ist. Nachrichten sind JSON-Texte:
//   Seite an Hülle: { art: 'bereit' } (die App läuft, die Hülle schickt, was ansteht); { art: 'weiter' } (siehe teilen);
//                   { nr, art: 'token-holen' }, Antwort { nr, art: 'token', token: Text oder null };
//                   { nr, art: 'token-setzen', token: Text oder null }, Antwort { nr, art: 'ok' } oder { nr, art: 'fehler' };
//                   { nr, art: 'speichern', name, typ, daten }: legt die Datei ab (daten ist Base64, höchstens 1 MiB; name ohne
//                   Pfad, höchstens 100 Zeichen; typ ein MIME-Typ). Die Hülle zeigt den Speichern-Dialog des Systems; Antwort
//                   { nr, art: 'ok' }, { nr, art: 'abgebrochen' } (der Nutzer schloss den Dialog) oder { nr, art: 'fehler' }.
//                   Der Dialog wartet auf den Nutzer, darum braucht frage('speichern', …) eine lange Wartezeit (3. Parameter).
//                   Dateien für <input type=file> (Datei anhängen) wählt die Hülle selbst (WebChromeClient), ohne Nachricht.
//   Hülle an Seite: { art: 'oeffnen', adresse: '#…' } (ein Link llmpost://…); { art: 'teilen', titel, text } (für Erfassen);
//                   zu Dateien aus dem Teilen (Foto, PDF, eine oder mehrere) kommen dazu `dateien` und `mehr`: dateien ist eine Liste
//                   von { name, typ, groesse, daten } (daten ist Base64) oder { name, typ, groesse, fehler, grenze } mit
//                   fehler 'zu-gross' (über grenze: kein Inhalt, nur Name und Größe), 'unlesbar' oder 'kein-zugriff' (der Intent
//                   gab keine Lesefreigabe, oder die Adresse ist kein content://; name ist dann 'Datei'); groesse ist null, wenn
//                   sie unbekannt ist. Die Grenze ist 1 MiB, für Bilder (JPEG, PNG, WebP, HEIC) 20 MiB; die Seite kodiert Fotos (und PNG
//                   über 1 MiB) neu und verkleinert sie dabei. Höchstens 10 Dateien, `mehr` zählt die weiteren. Text und Titel fehlen, wenn nur Dateien
//                   geteilt werden (dann leer). Ein Teilen kommt als mehrere Nachrichten `teilen`: erst Titel, Text, abgelehnte
//                   Dateien und `mehr` (nur wenn es etwas davon gibt), dann je lesbare Datei eine mit `dateien` von einem Eintrag.
//                   Nach jeder Nachricht `teilen` schickt die Seite { art: 'weiter' }, erst dann liest die Hülle die nächste
//                   Datei: so liegt nie mehr als eine große Datei im Speicher;
//                   { art: 'farben', hell: { ROLLE: '#rrggbb', … }, dunkel: { … } } (Systemfarben, Material You; die Rollen heißen
//                   wie die Variablen in app.css ohne `--`, die Liste steht in farben.js; die Hülle schickt sie nach bereit und
//                   erneut, wenn sich die Systemfarben ändern; ungültige Werte und unbekannte Rollen übergeht die Seite).
// Jede Nachricht der Hülle ohne nr ist eine Art mit beliebigen Feldern: Die App meldet für jede Art einen Empfänger an
// (verbinde); Arten ohne Empfänger werden übergangen. Ein neuer Wert der Hülle braucht so nur einen weiteren Empfänger in der
// App. Die Hülle übergeht Arten der Seite, die sie nicht kennt.
// Das Token liegt in der Hülle (Android Keystore), nie in IndexedDB: mitTresor leitet nur die Anmeldung dorthin um.
import { parse } from './adressen.js';
import { teileAuf } from './anhaenge.js';

export const BRUECKE = 'llmpost';
export const WARTEZEIT_MS = 5000;

const zeitgeberVorgabe = { setze: (f, ms) => setTimeout(f, ms), loesche: (t) => clearTimeout(t) };

export class Huelle {
  #objekt;
  #zeitgeber;
  #nr = 0;
  #offen = new Map();
  #empfaenger = null;
  #gesammelt = [];

  /**
   * @param {object} objekt  das Objekt der Hülle (postMessage, onmessage)
   * @param {object} p
   * @param {{ setze: Function, loesche: Function }} p.zeitgeber  für die Wartezeit, im Test von Hand ausgelöst
   */
  constructor(objekt, { zeitgeber = zeitgeberVorgabe } = {}) {
    this.#objekt = objekt;
    this.#zeitgeber = zeitgeber;
    objekt.onmessage = (e) => this.#empfange(e?.data);
  }

  #empfange(text) {
    let n;
    try { n = JSON.parse(text); } catch { return; }
    if (!n || typeof n !== 'object' || Array.isArray(n) || typeof n.art !== 'string') return;
    if ('nr' in n) {
      const o = this.#offen.get(n.nr);
      if (!o) return;
      this.#offen.delete(n.nr);
      this.#zeitgeber.loesche(o.uhr);
      o.ok(n);
      return;
    }
    if (this.#empfaenger) this.#stelleZu(n); else this.#gesammelt.push(n);
  }

  #stelleZu(n) {
    const f = this.#empfaenger[n.art];
    if (typeof f === 'function') f(n);
  }

  #sende(o) { this.#objekt.postMessage(JSON.stringify(o)); }

  /** Fragt die Hülle; erfüllt sich mit der Antwort derselben nr, nach `wartezeit` (Vorgabe WARTEZEIT_MS) ohne Antwort ein Fehler. */
  frage(art, daten = {}, wartezeit = WARTEZEIT_MS) {
    const nr = ++this.#nr;
    return new Promise((ok, fehler) => {
      const uhr = this.#zeitgeber.setze(() => {
        if (!this.#offen.delete(nr)) return;
        fehler(new Error('Die Hülle antwortet nicht.'));
      }, wartezeit);
      this.#offen.set(nr, { ok, uhr });
      this.#sende({ ...daten, nr, art });
    });
  }

  /** Meldet die Empfänger an ({ art: Funktion }); gesammelte Nachrichten gehen jetzt in ihrer Reihenfolge raus. */
  verbinde(empfaenger) {
    this.#empfaenger = { ...empfaenger };
    const liste = this.#gesammelt;
    this.#gesammelt = [];
    for (const n of liste) this.#stelleZu(n);
  }

  /** Die App läuft; die Hülle schickt jetzt, was ansteht (Link, geteilter Text). */
  bereit() { this.#sende({ art: 'bereit' }); }

  /** Eine Nachricht `teilen` ist verarbeitet; die Hülle liest und schickt die nächste Datei (immer nur eine zugleich im Speicher). */
  weiter() { this.#sende({ art: 'weiter' }); }
}

/** Die Hülle, wenn die Seite in ihr läuft, sonst null. */
export function huelleVon(g = globalThis) {
  const o = g?.[BRUECKE];
  return o && typeof o.postMessage === 'function' ? new Huelle(o) : null;
}

const istAnmeldung = (name, schluessel) => name === 'einstellungen' && schluessel === 'anmeldung';
const alsToken = (t) => (typeof t === 'string' && t !== '' ? t : null);

/**
 * Der Speicher der App mit dem Token in der Hülle: Die Anmeldung steht ohne Token in `db`, das Token fragt die Seite
 * einmal bei der Hülle ab und hält es im Speicher der Seite. Alles andere geht unverändert an `db`.
 */
export function mitTresor(db, huelle) {
  let token;
  let geholt = false;
  const holen = async () => {
    if (!geholt) { token = alsToken((await huelle.frage('token-holen'))?.token); geholt = true; }
    return token;
  };
  const ablegen = async (t) => {
    const a = await huelle.frage('token-setzen', { token: t });
    if (a?.art !== 'ok') throw new Error('Das Token ließ sich auf diesem Gerät nicht sicher ablegen.');
    token = t;
    geholt = true;
  };
  return {
    ...db,
    async lies(name, schluessel) {
      const v = await db.lies(name, schluessel);
      if (!istAnmeldung(name, schluessel) || v === undefined) return v;
      return { ...v, wert: { ...v.wert, token: await holen() } };
    },
    async schreibe(name, wert) {
      if (!istAnmeldung(name, wert?.name) || !wert?.wert || !('token' in wert.wert)) return db.schreibe(name, wert);
      const { token: t, ...rest } = wert.wert;
      await ablegen(alsToken(t));
      return db.schreibe(name, { ...wert, wert: rest });
    },
    async entferne(name, schluessel) {
      if (istAnmeldung(name, schluessel)) await ablegen(null);
      return db.entferne(name, schluessel);
    },
    async aendere(ops) {
      for (const op of ops) {
        const k = 'setze' in op ? op.setze?.name : op.entferne;
        if (istAnmeldung(op.speicher, k)) throw new Error('Die Anmeldung geht nur über schreibe.');
      }
      return db.aendere(ops);
    },
  };
}

/** Legt einen geteilten Text in den Entwurf von Erfassen; alle anderen Felder bleiben, wie sie sind. */
export function mitGeteiltem(entwurf, { titel = '', text = '' } = {}) {
  const e = { ...entwurf };
  const neuTitel = String(titel ?? '').replace(/\s+/g, ' ').trim().slice(0, 120).trimEnd();
  if (String(e.titel ?? '') === '') e.titel = neuTitel;
  const neuText = String(text ?? '').trim();
  const alt = String(e.text ?? '');
  if (neuText !== '') e.text = alt === '' ? neuText : `${alt.trimEnd()}\n\n${neuText}`;
  else e.text = alt;
  return e;
}

/** Die Adresse aus einem Link der Hülle; eine unbekannte Adresse öffnet Wartet. */
export const adresseAusHuelle = (adresse) => parse(String(adresse ?? ''))?.adresse ?? '#wartet';

/**
 * Legt geteilte Dateien (Feld `dateien` der Nachricht `teilen`) in den Entwurf der Anhänge. `alt` ist der bisherige Entwurf
 * (oder null), `verkleinere` verkleinert zu große Bilder (anhaenge.js: teileAuf). Ergebnis: der neue Entwurf { anhaenge,
 * fehler, hinweise } oder null, wenn nichts geteilt wurde. `fehler` und `hinweise` sind Sätze zu abgelehnten Dateien und zu
 * Anhängen; sie bleiben im Entwurf, bis der Nutzer sie in Erfassen mit **Verstanden** schließt (anhangwahl.js), und sammeln
 * sich über mehrere Nachrichten desselben Teilens (gleiche Sätze nur einmal).
 */
export async function mitGeteiltenDateien(alt, { dateien, mehr } = {}, verkleinere = null) {
  if (!(Array.isArray(dateien) && dateien.length) && !(Number.isInteger(mehr) && mehr > 0)) return null;
  const r = await teileAuf(alt?.anhaenge ?? [], dateien, mehr, verkleinere);
  const dazu = (bisher, neu) => [...new Set([...(Array.isArray(bisher) ? bisher : []), ...neu])];
  return { anhaenge: r.liste, fehler: dazu(alt?.fehler, r.fehler), hinweise: dazu(alt?.hinweise, r.hinweise) };
}
