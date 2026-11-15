// Neue Fassung (UOF-5): wartet ein neuer Service Worker, zeigt die App ein ruhiges Band mit **Neu starten**. Sie wechselt nie
// von selbst: erst der Knopf schickt „wechseln“ an den wartenden Worker, und erst danach (controllerchange) lädt die Seite
// einmal neu. Ungesendete Sendungen und Entwürfe liegen in IndexedDB und überstehen das Neuladen. Die Teile des Browsers
// (Service-Worker-Container, Registrierung, Neuladen) sind Parameter, damit node --test den Ablauf ohne Browser prüft.
import { WECHSELN, aktualisierungWartet } from './swlogik.js';
import { NEUE_FASSUNG, NEU_STARTET } from './texte.js';

export class Aktualisierung {
  /**
   * @param {object} p
   * @param {object} p.container  navigator.serviceWorker (controller, addEventListener)
   * @param {() => void} p.laden  lädt die Seite neu (Vorgabe: location.reload)
   * @param {() => boolean} p.amNetz  Meldet das Gerät Netz? Ohne Netz fragt die App nicht nach Updates.
   */
  constructor({ container, laden = () => location.reload(), amNetz = () => navigator.onLine } = {}) {
    this.container = container;
    this.laden = laden;
    this.amNetz = amNetz;
    this.registrierung = null;
    this.horcher = [];
    this.angefordert = false;   // der Nutzer hat in dieser Seite Neu starten getippt
    this.geladen = false;       // höchstens einmal neu laden
    this.wartend = false;
    container?.addEventListener?.('controllerchange', () => {
      // Wechselt die Steuerung, weil eine andere Seite der App es wollte, lädt diese Seite nicht neu: dort könnte jemand schreiben.
      if (this.angefordert && !this.geladen) { this.geladen = true; this.laden(); }
    });
  }

  /** Wartet eine neue Fassung auf den Nutzer? */
  get wartet() { return this.wartend; }

  /** Der Nutzer hat Neu starten getippt; die Seite lädt gleich neu. */
  get startet() { return this.angefordert; }

  beiAenderung(f) { this.horcher.push(f); }

  #pruefeWartet() {
    const jetzt = aktualisierungWartet({ waiting: this.registrierung?.waiting, controller: this.container?.controller });
    if (jetzt === this.wartend) return;
    this.wartend = jetzt;
    for (const f of this.horcher) f(jetzt);
  }

  /** Beobachtet die Registrierung: eine neue Fassung wartet, sobald sie fertig installiert ist. */
  beobachte(registrierung) {
    this.registrierung = registrierung;
    registrierung.addEventListener?.('updatefound', () => {
      const neu = registrierung.installing;
      neu?.addEventListener('statechange', () => this.#pruefeWartet());
    });
    this.#pruefeWartet();
  }

  /** Fragt nach einer neuen Fassung (beim Öffnen und bei der Rückkehr in den Vordergrund); ohne Netz still. */
  async pruefe() {
    if (!this.registrierung || !this.amNetz()) return false;
    try { await this.registrierung.update(); } catch { return false; }   // ohne Netz oder bei einem Fehler des Servers still
    this.#pruefeWartet();
    return true;
  }

  /** Der Knopf Neu starten: gibt den wartenden Worker frei; die Seite lädt nach controllerchange neu. */
  neustart() {
    const worker = this.registrierung?.waiting;
    if (!worker || this.angefordert) return false;
    this.angefordert = true;
    worker.postMessage(WECHSELN);
    for (const f of this.horcher) f(this.wartend);
    return true;
  }
}

/** Fragt beim Öffnen und bei jeder Rückkehr in den Vordergrund nach einer neuen Fassung. */
export function pruefeRegelmaessig(aktualisierung, dokument = globalThis.document) {
  aktualisierung.pruefe();
  dokument.addEventListener('visibilitychange', () => { if (dokument.visibilityState === 'visible') aktualisierung.pruefe(); });
}

/**
 * Zeigt das Band unten (Snackbar `#neu` in index.html) und lässt den Knopf neu starten. In Mehr steht dasselbe Band bei
 * „Fassung“; dort bleibt die Snackbar weg, damit der Satz nicht doppelt steht. Gibt `ansicht(name)` zurück, das der App
 * sagt, welche Ansicht gerade offen ist.
 */
export function zeigeNeuBand(aktualisierung, wurzel = document) {
  const kasten = wurzel.getElementById('neu');
  if (!kasten) return { ansicht() {} };
  const text = wurzel.getElementById('neu-text');
  const knopf = wurzel.getElementById('neu-knopf');
  let inMehr = false;
  const setzen = () => {
    kasten.hidden = !aktualisierung.wartet || inMehr;
    text.textContent = aktualisierung.startet ? NEU_STARTET : NEUE_FASSUNG.satz;
    knopf.hidden = aktualisierung.startet;
  };
  knopf.addEventListener('click', () => aktualisierung.neustart());
  aktualisierung.beiAenderung(setzen);
  setzen();
  return { ansicht(name) { inMehr = name === 'mehr'; setzen(); } };
}
