// Prüfung, ob das Gerät wirklich Netz hat. navigator.onLine allein reicht nicht: unter einem dauerhaften VPN bleibt es im
// Flugmodus auf true, weil Android das VPN-Netz weiter als verbunden listet (Chromium liest ConnectivityManager). Die
// Spezifikation verspricht nur: false heißt sicher offline, true heißt „vielleicht online“. Darum gilt:
// - onLine === false: sofort offline, ohne Anfrage;
// - sonst eine Probe auf den eigenen Ursprung (HEAD, cache: no-store, höchstens 3 s) beim Start, bei online/offline, bei der
//   Rückkehr in den Vordergrund, nach einem gescheiterten Abgleich und vor jedem Abgleich und jeder Sendung, wenn die
//   letzte gelungene Probe älter als FRISCH_MS ist;
// - offline und sichtbar: neue Probe mit wachsendem Abstand (5 s bis 60 s); gelingt sie, meldet `bei(true)`.
// Die Probe läuft am Service Worker vorbei: der fängt nur GET ab, ein HEAD geht ans Netz. Alles Äußere ist Parameter (node --test).

export const PROBE_ZEIT_MS = 3000;
export const FRISCH_MS = 10_000;
export const ABSTAENDE_MS = [5000, 10_000, 20_000, 40_000, 60_000];

export class Netzpruefer {
  /**
   * @param {object} o
   * @param {typeof fetch} o.fetch
   * @param {string|null} o.adresse   Datei auf dem eigenen Ursprung; null: keine Probe, nur onLine
   * @param {() => boolean} [o.onLine]
   * @param {() => boolean} [o.sichtbar]
   * @param {() => number} [o.jetzt]
   * @param {{setze: Function, loesche: Function}} [o.zeitgeber]
   */
  constructor({ fetch, adresse, onLine = () => true, sichtbar = () => true, jetzt = () => Date.now(),
    zeitgeber = { setze: (f, ms) => setTimeout(f, ms), loesche: (t) => clearTimeout(t) } }) {
    Object.assign(this, { fetch, adresse, onLine, sichtbar, jetzt, zeitgeber });
    this.ohne = false;          // die letzte Probe scheiterte
    this.gelungen = -Infinity;  // Zeit der letzten gelungenen Probe
    this.stufe = 0;
    this.timer = null;
    this.laeuft = null;
    this.horcher = new Set();
  }

  /** Meldet jeden Wechsel (true: Netz da, false: kein Netz); gibt eine Funktion zurück, die den Horcher entfernt. */
  beiAenderung(f) {
    this.horcher.add(f);
    return () => this.horcher.delete(f);
  }

  /** Hat das Gerät Netz? Sofort, ohne Anfrage. */
  amNetz() {
    return this.onLine() !== false && !this.ohne;
  }

  /**
   * Prüft das Netz und gibt `amNetz()` zurück. Ohne `erzwingen` gilt eine Probe, die höchstens FRISCH_MS her ist; war die letzte
   * Probe negativ, fragt allein der Zeitgeber mit Abstand erneut (sonst fragte jeder Abgleich einzeln).
   */
  pruefe({ erzwingen = false } = {}) {
    if (this.onLine() === false) { this.setze(true); return Promise.resolve(false); }
    if (!this.adresse) { this.setze(false); return Promise.resolve(true); }
    if (!erzwingen && (this.ohne || this.jetzt() - this.gelungen < FRISCH_MS)) return Promise.resolve(this.amNetz());
    return this.probe();
  }

  probe() {
    if (this.laeuft) return this.laeuft;
    this.laeuft = this.frage().then((da) => {
      if (da) this.gelungen = this.jetzt();
      this.setze(!da);
      return this.amNetz();
    }).finally(() => { this.laeuft = null; });
    return this.laeuft;
  }

  async frage() {
    const abbruch = new AbortController();
    const t = this.zeitgeber.setze(() => abbruch.abort(), PROBE_ZEIT_MS);
    try {
      // Jede Antwort zeigt, dass der Ursprung erreichbar ist, auch eine Ablehnung
      await this.fetch(`${this.adresse}?netz=${this.jetzt()}`, { method: 'HEAD', cache: 'no-store', signal: abbruch.signal });
      return true;
    } catch {
      return false;
    } finally {
      this.zeitgeber.loesche(t);
    }
  }

  setze(ohne) {
    const vorher = this.amNetz();
    this.ohne = ohne;
    if (ohne) this.plane();
    else { this.zeitgeber.loesche(this.timer); this.timer = null; this.stufe = 0; }
    const jetzt = this.amNetz();
    if (jetzt !== vorher) for (const f of this.horcher) f(jetzt);
  }

  /** Offline und sichtbar: nach wachsendem Abstand erneut proben. */
  plane() {
    if (this.timer || !this.sichtbar()) return;
    const warte = ABSTAENDE_MS[Math.min(this.stufe++, ABSTAENDE_MS.length - 1)];
    this.timer = this.zeitgeber.setze(() => { this.timer = null; this.erneut(); }, warte);
  }

  erneut() {
    if (!this.sichtbar()) return;   // sichtbarWurde holt es nach
    if (this.onLine() === false) { this.plane(); return; }   // das Ereignis online löst die Probe aus
    this.probe();
  }

  /** online, offline oder zurück im Vordergrund: sofort neu prüfen. */
  ereignis() {
    this.stufe = 0;
    return this.pruefe({ erzwingen: true });
  }

  sichtbarWurde() {
    if (this.ohne || this.jetzt() - this.gelungen >= FRISCH_MS) return this.pruefe({ erzwingen: true });
    return Promise.resolve(this.amNetz());
  }
}

/** Verbindet die Prüfung mit dem Browser: online, offline, Sichtbarkeit, und prüft einmal beim Start. */
export function verbindePruefer(pruefer, ziel = globalThis, dokument = globalThis.document) {
  ziel.addEventListener('online', () => pruefer.ereignis());
  ziel.addEventListener('offline', () => pruefer.ereignis());
  dokument.addEventListener('visibilitychange', () => { if (dokument.visibilityState === 'visible') pruefer.sichtbarWurde(); });
  pruefer.pruefe({ erzwingen: true });
  return pruefer;
}
