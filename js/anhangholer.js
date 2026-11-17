// Der Inhalt eines Anhangs: aus dem Speicher des Geräts (Speicher anhaenge), sonst über die Blob-Abfrage von GitHub, und nach
// dem ersten Laden im Speicher. Datenbank, fetch, Anmeldung und Uhr sind Parameter, damit node --test es prüft.
// Ergebnis von inhalt(): { ok: true, daten (Base64), vomGeraet } oder { ok: false, art, ... } mit art
//   zu-gross (über 1 MiB, nach dem Baum oder der Antwort), netz (keine Antwort, ohne Netz), token, limit (bis = ms oder null),
//   verboten, nicht-gefunden, antwort (status), anmeldung (keine Anmeldung auf diesem Gerät).
import { ANHANG_MAX } from './anhaenge.js';
import { holeAnhang } from './abgleich.js';

export class Anhangholer {
  #laeuft = new Map();

  constructor({ db, fetch, anmeldung, jetzt = () => Date.now() }) {
    Object.assign(this, { db, fetch, anmeldung, jetzt });
  }

  /** Liegt der Inhalt schon auf dem Gerät? */
  async gespeichert(sha) { return (await this.db.lies('anhaenge', sha)) !== undefined; }

  /** Der Inhalt von `a` ({ sha, groesse }); gleichzeitige Aufrufe für denselben Anhang teilen sich eine Anfrage. */
  inhalt(a) {
    if (!this.#laeuft.has(a.sha)) this.#laeuft.set(a.sha, this.#lade(a).finally(() => this.#laeuft.delete(a.sha)));
    return this.#laeuft.get(a.sha);
  }

  async #lade(a) {
    const da = await this.db.lies('anhaenge', a.sha);
    if (da) return { ok: true, daten: da.daten, vomGeraet: true };
    if (a.groesse > ANHANG_MAX) return { ok: false, art: 'zu-gross' };
    if (!this.fetch) return { ok: false, art: 'netz' };
    const quelle = await this.anmeldung();
    if (!quelle) return { ok: false, art: 'anmeldung' };
    try {
      const daten = await holeAnhang({ fetch: this.fetch, quelle: { repo: quelle.repo, token: quelle.token }, sha: a.sha, jetzt: this.jetzt });
      await this.db.schreibe('anhaenge', { sha: a.sha, daten, zeit: this.jetzt() });
      return { ok: true, daten, vomGeraet: false };
    } catch (e) {
      if (e?.name !== 'AbgleichFehler') throw e;
      return { ok: false, art: e.art === 'abgebrochen' ? 'netz' : e.art, bis: e.bis ?? null, status: e.status ?? null };
    }
  }
}
