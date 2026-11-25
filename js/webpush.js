// Web-Push: Chromium stellt Web-Push über den Push-Dienst von Google zu, und mit den Google Play Services in
// der Sandbox von GrapheneOS geht das in Vanadium (das Abo selbst bleibt dem Test auf dem Handy). Dieses Modul schaltet das Abo ein und aus; das
// Postwerkzeug schickt die Pushes (claude-post webpush). Der Push trägt keinen Text, der Service Worker zeigt einen festen Satz
// (js/swlogik.js). Die Teile des Browsers (Service-Worker-Container, Benachrichtigung, Zwischenablage) und der Speicher des
// Schlüssels sind Parameter; die Prüfung des Schlüssels und die Texte sind rein und laufen unter node --test. Entfernen: diese Datei, der Abschnitt in
// js/mehr.js, die Zeilen in app.js, die Handler in sw.js samt ihrer Logik in js/swlogik.js.
import { WEBPUSH } from './texte.js';

/** Der öffentliche VAPID-Schlüssel ist ein unkomprimierter P-256-Punkt: 65 Byte, das erste ist 4, base64url ohne Auffüllung. */
export const SCHLUESSEL_BYTES = 65;

/** base64url in Bytes; null, wenn der Text kein base64url ist. */
export function vonBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const roh = atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(roh, (c) => c.charCodeAt(0));
}

/** Prüft die Eingabe des Schlüssels: `{ ok: true, bytes, text }` oder `{ ok: false, fehler }` (der Satz nennt nie die Eingabe). */
export function pruefeSchluessel(eingabe) {
  const text = String(eingabe ?? '').trim();
  if (!text) return { ok: false, fehler: WEBPUSH.fehler.schluesselFehlt };
  const bytes = vonBase64Url(text);
  if (!bytes) return { ok: false, fehler: WEBPUSH.fehler.schluesselZeichen };
  if (bytes.length !== SCHLUESSEL_BYTES || bytes[0] !== 4) return { ok: false, fehler: WEBPUSH.fehler.schluesselForm };
  return { ok: true, bytes, text };
}

/** Der Host einer Push-Adresse (fcm.googleapis.com); die Adresse selbst ist ein Zugang und erscheint nie. */
export function hostVon(adresse) {
  try { return new URL(adresse).hostname; } catch { return null; }
}

/** Der genaue Fehlertext des Browsers: Name und Meldung, wie `subscribe` sie wirft. */
export function fehlerText(e) {
  if (e && typeof e === 'object') return [e.name, e.message].filter(Boolean).join(': ') || String(e);
  return String(e);
}

const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export class WebPushProbe {
  /**
   * @param {object} p
   * @param {object|null} p.dienst  navigator.serviceWorker (`getRegistration`), null ohne Service Worker
   * @param {object|null} p.benachrichtigung  die Klasse Notification (permission, requestPermission)
   * @param {object|null} p.zwischenablage  navigator.clipboard (writeText)
   * @param {boolean} p.hatPush  Gibt es PushManager?
   * @param {{ lies: () => Promise<string>, schreibe: (s: string) => Promise<void> }} p.schluessel  Speicher des eingegebenen Schlüssels
   */
  constructor({ dienst, benachrichtigung, zwischenablage, hatPush, schluessel }) {
    Object.assign(this, { dienst, benachrichtigung, zwischenablage, hatPush, schluessel });
    this.ergebnis = null;   // { ton: 'ok' | 'info' | 'fehler', titel, satz, einzelheiten? } nach dem letzten Tipp
  }

  get unterstuetzt() { return Boolean(this.dienst && this.benachrichtigung && this.hatPush); }

  /** Die Registrierung des Service Workers; `ready` bliebe ohne Worker für immer offen und würde Mehr blockieren. */
  async #registrierung() {
    const r = await this.dienst.getRegistration();
    if (!r) throw new Error(WEBPUSH.fehler.keinWorker);
    return r;
  }

  /** Stand für die Ansicht: unterstützt, Berechtigung, Host des Abos (oder null), gemerkter Schlüssel, letztes Ergebnis. */
  async zustand() {
    const z = { unterstuetzt: this.unterstuetzt, berechtigung: this.benachrichtigung?.permission ?? null, host: null, schluessel: '', ergebnis: this.ergebnis };
    try { z.schluessel = (await this.schluessel.lies()) ?? ''; } catch { /* ohne Speicher bleibt das Feld leer */ }
    if (!z.unterstuetzt) return z;
    try { z.host = hostVon((await (await this.#registrierung()).pushManager.getSubscription())?.endpoint ?? ''); } catch (e) { z.ergebnis = { ton: 'fehler', titel: WEBPUSH.fehler.abfrage, satz: WEBPUSH.fehler.browser, einzelheiten: fehlerText(e) }; }
    return z;
  }

  /** Merkt die Eingabe des Schlüssels, damit ein Neuzeichnen oder Neuladen sie nicht löscht. */
  merke(text) { return Promise.resolve(this.schluessel.schreibe(String(text ?? '').trim())).catch(() => {}); }

  /** Einschalten: Schlüssel prüfen, Mitteilungen erlauben lassen (im Zusammenhang mit dem Tipp), `subscribe` mit userVisibleOnly. */
  async einschalten(eingabe) {
    await this.merke(eingabe);
    const s = pruefeSchluessel(eingabe);
    if (!s.ok) return this.#fehler(WEBPUSH.fehler.schluesselTitel, s.fehler);
    if (!this.unterstuetzt) return this.#fehler(WEBPUSH.fehler.nichtDa, WEBPUSH.fehler.nichtDaSatz);
    try {
      if (this.benachrichtigung.permission !== 'granted') {
        const antwort = await this.benachrichtigung.requestPermission();
        if (antwort !== 'granted') return this.#fehler(WEBPUSH.fehler.erlaubnisTitel, WEBPUSH.fehler.erlaubnisSatz, `Berechtigung: ${antwort}`);
      }
      const manager = (await this.#registrierung()).pushManager;
      const alt = await manager.getSubscription();
      const altSchluessel = alt?.options?.applicationServerKey ? new Uint8Array(alt.options.applicationServerKey) : null;
      if (alt && !(altSchluessel && gleich(altSchluessel, s.bytes))) await alt.unsubscribe();   // ein Abo gehört zu genau einem Schlüssel
      const abo = alt && altSchluessel && gleich(altSchluessel, s.bytes) ? alt : await manager.subscribe({ userVisibleOnly: true, applicationServerKey: s.bytes });
      this.ergebnis = { ton: 'ok', titel: WEBPUSH.ok.titel, satz: WEBPUSH.ok.satz(hostVon(abo.endpoint)) };
    } catch (e) {
      return this.#fehler(WEBPUSH.fehler.einschaltenTitel, WEBPUSH.fehler.browser, fehlerText(e));
    }
    return this.ergebnis;
  }

  /** Das Abo als JSON in die Zwischenablage; am Rechner fügt `claude-post webpush setup` es ein. */
  async kopieren() {
    try {
      const abo = await (await this.#registrierung()).pushManager.getSubscription();
      if (!abo) return this.#fehler(WEBPUSH.fehler.keinAbo, WEBPUSH.fehler.keinAboSatz);
      await this.zwischenablage.writeText(JSON.stringify(abo.toJSON()));
      this.ergebnis = { ton: 'info', titel: WEBPUSH.kopiert.titel, satz: WEBPUSH.kopiert.satz };
    } catch (e) {
      return this.#fehler(WEBPUSH.fehler.kopierenTitel, WEBPUSH.fehler.browser, fehlerText(e));
    }
    return this.ergebnis;
  }

  /** Abo beenden: der Browser meldet es beim Push-Dienst ab. Das Postwerkzeug entfernt seine Dateien mit `claude-post webpush off`. */
  async beenden() {
    try {
      const abo = await (await this.#registrierung()).pushManager.getSubscription();
      const war = Boolean(abo);
      if (abo) await abo.unsubscribe();
      this.ergebnis = { ton: 'info', titel: war ? WEBPUSH.beendet.titel : WEBPUSH.beendet.keins, satz: WEBPUSH.beendet.satz };
    } catch (e) {
      return this.#fehler(WEBPUSH.fehler.beendenTitel, WEBPUSH.fehler.browser, fehlerText(e));
    }
    return this.ergebnis;
  }

  #fehler(titel, satz, einzelheiten = null) {
    this.ergebnis = { ton: 'fehler', titel, satz, ...(einzelheiten ? { einzelheiten } : {}) };
    return this.ergebnis;
  }
}

/** Die Teile des Browsers für die App; ohne Service Worker oder PushManager ist `unterstuetzt` falsch. */
export function browserProbe(schluessel) {
  const g = globalThis;
  return new WebPushProbe({
    dienst: g.navigator?.serviceWorker ?? null, benachrichtigung: g.Notification ?? null, zwischenablage: g.navigator?.clipboard ?? null,
    hatPush: 'PushManager' in g, schluessel,
  });
}
