// Steuerung des Abgleichs: wann er läuft und was die Ansicht davon zeigt. Auslöser sind das Öffnen der App, die
// Rückkehr ins Netz, der Knopf Jetzt abgleichen und im Vordergrund ein fester Takt (Vorgabe 120 s, einstellbar, E11).
// Es läuft immer höchstens ein Abgleich. Auf Background Sync verlässt sich die App nicht (B1, 5.5).
// Ohne Netz gilt, wer am Netz scheitert (UOF-4): die App fragt dann alle 10 s erneut, weil mit einem VPN kein Ereignis
// online kommt. Fehler, die nur der Nutzer beheben kann (Token, Rechte, Repo), lösen keinen Takt aus.
// Alles Äußere kommt als Parameter (fetch, Uhr, Zeitgeber, Sichtbarkeit), damit node --test es ohne Browser prüft.
import { AbgleichFehler, abgleichen, leseStand } from './abgleich.js';
import { einstellung } from './speicher.js';
import { merkeUhr } from './erzeugen.js';

export const TAKT_VORGABE_S = 120;
export const OFFLINE_FRAGE_MS = 10_000;
/** Wählbare Takte in Sekunden; 0 heißt nur mit dem Knopf. */
export const TAKTE = [60, 120, 300, 900, 0];
const NUR_NUTZER = new Set(['token', 'verboten', 'nicht-gefunden', 'einstellung', 'zu-gross']);

export class Abgleichsteuerung {
  // Die Zeitgeber stehen in Funktionen, die setTimeout und clearTimeout ohne Empfänger rufen: als Methode eines anderen
  // Objekts werfen sie im Browser "Illegal invocation".
  constructor({ db, fetch, jetzt = () => Date.now(), zeitgeber = { setze: (f, ms) => setTimeout(f, ms), loesche: (t) => clearTimeout(t) },
    sichtbar = () => true, amNetz = () => true }) {
    Object.assign(this, { db, fetch, jetzt, zeitgeber, sichtbar, amNetz });
    this.horcher = new Set();
    this.timer = null;
    this.faellig = false;
    this.laufend = null;
    this.zustand = { phase: 'bereit', fortschritt: null, fehler: null, ohneNetz: false, letzter: null, naechster: null };
  }

  /** Meldet jede Änderung des Zustands; gibt eine Funktion zurück, die den Horcher entfernt. */
  beiAenderung(f) {
    this.horcher.add(f);
    return () => this.horcher.delete(f);
  }

  setze(teil) {
    this.zustand = { ...this.zustand, ...teil };
    for (const f of this.horcher) f(this.zustand);
  }

  async anmeldung() {
    const a = await einstellung(this.db, 'anmeldung');
    return a?.repo && a?.token ? a : null;
  }

  /** Der Takt in Sekunden aus den Einstellungen; 0 heißt nur von Hand. */
  async takt() {
    const t = await einstellung(this.db, 'takt', TAKT_VORGABE_S);
    return TAKTE.includes(t) ? t : TAKT_VORGABE_S;
  }

  /** Beim Öffnen: den Stand aus der Datenbank zeigen und abgleichen. */
  async start() {
    const stand = await leseStand(this.db);
    if (stand) this.setze({ letzter: { geprueft: stand.baum.geprueft ?? stand.baum.zeit, dateien: stand.baum.eintraege.length } });
    return this.lauf('start');
  }

  /** Ein Abgleich; läuft schon einer, gibt es dessen Ergebnis. */
  lauf(grund) {
    if (this.laufend) return this.laufend;
    this.laufend = this.abgleichen(grund).finally(() => { this.laufend = null; });
    return this.laufend;
  }

  async abgleichen() {
    this.zeitgeber.loesche(this.timer);
    this.timer = null;
    this.faellig = false;
    const quelle = await this.anmeldung();
    if (!quelle) {
      this.setze({ phase: 'ohne-anmeldung', fortschritt: null, fehler: null, ohneNetz: false, naechster: null });
      return null;
    }
    this.setze({ phase: 'laeuft', fortschritt: { phase: 'baum' }, fehler: null });
    try {
      const r = await abgleichen({ fetch: this.fetch, db: this.db, quelle, jetzt: this.jetzt, bei: (f) => this.setze({ fortschritt: f }) });
      await merkeUhr(this.db, r.serverzeit, this.jetzt());   // Uhr des Geräts gegen den Date-Kopf (Teil E ordnet Dateien nach ihr)
      const geprueft = (await this.db.lies('baum', 'stand'))?.geprueft ?? this.jetzt();
      this.setze({ phase: 'bereit', fortschritt: null, fehler: null, ohneNetz: false, letzter: { geprueft, dateien: r.dateien } });
      await this.plane();
      return r;
    } catch (e) {
      // Ein Fehler im eigenen Code zeigt sich wie jeder andere, statt eine Zusage unbemerkt abzulehnen
      const fehler = e instanceof AbgleichFehler ? e : new AbgleichFehler('intern', String(e?.message ?? e));
      // Eine Antwort des Servers, auch eine Ablehnung, hebt "ohne Netz" auf (UOF-4)
      this.setze({ phase: 'fehler', fortschritt: null, fehler, ohneNetz: fehler.art === 'netz' });
      await this.plane();
      return null;
    }
  }

  /** Plant den nächsten Abgleich nach Takt; bei Fehlern, die nur der Nutzer behebt, keinen. */
  async plane() {
    this.zeitgeber.loesche(this.timer);
    this.timer = null;
    const fehler = this.zustand.fehler;
    const takt = await this.takt();
    if (!(await this.anmeldung()) || (fehler && NUR_NUTZER.has(fehler.art))) { this.setze({ naechster: null }); return; }
    let warte = takt * 1000;
    if (this.zustand.ohneNetz) warte = OFFLINE_FRAGE_MS;
    else if (!takt) { this.setze({ naechster: null }); return; }
    if (fehler?.art === 'limit' && fehler.bis) warte = Math.max(warte, fehler.bis - this.jetzt() + 1000);
    this.setze({ naechster: this.jetzt() + warte });
    this.timer = this.zeitgeber.setze(() => this.takten(), warte);
  }

  /** Der Takt ist abgelaufen: im Vordergrund abgleichen, sonst beim nächsten Sichtbarwerden. */
  takten() {
    this.timer = null;
    if (!this.sichtbar()) { this.faellig = true; return; }
    this.lauf('takt');
  }

  /** Die App wird wieder sichtbar: war ein Abgleich fällig, läuft er jetzt. */
  sichtbarWurde() {
    if (this.faellig && !this.laufend) this.lauf('sichtbar');
  }

  /** Das Gerät meldet Netz: sofort abgleichen. */
  netzDa() {
    if (this.amNetz()) this.lauf('netz');
  }

  /** Der Knopf Jetzt abgleichen. */
  jetztAbgleichen() {
    return this.lauf('knopf');
  }

  stop() {
    this.zeitgeber.loesche(this.timer);
    this.timer = null;
  }
}

/** Verbindet die Steuerung mit dem Browser: Öffnen, online, Sichtbarkeit. Gibt die Steuerung zurück. */
export function verbinde(steuerung, ziel = globalThis, dokument = globalThis.document) {
  ziel.addEventListener('online', () => steuerung.netzDa());
  dokument.addEventListener('visibilitychange', () => { if (dokument.visibilityState === 'visible') steuerung.sichtbarWurde(); });
  steuerung.start();
  return steuerung;
}
