// Die Schreibschicht (Teil E): `k.schreiben` ist ein Schreiber mit diesen Funktionen; jede gibt eine Zusage zurück und reiht
// die Sendung in die Warteschlange (Speicher „schlange“), statt sofort zu senden:
//
//   antworten(id, { wahl, text, anhaenge, entwurf })  Antwort auf eine Frage (wahl ist der Schlüssel einer Möglichkeit) oder Nachtrag;
//                                                 anhaenge sind [{ name, groesse, typ, daten (Base64) }] (docs: anhaenge.js)
//   urteilSenden(id, { text, entwurf })           Antwort auf eine Abnahme; text ist der Antworttext (abnahme.js antwortText)
//   erledigen(id)                                 Eintrag erledigen
//   einsortieren(id, { ziel, satz, entwurf })     Nachtrag mit To und Project; ziel ist „user“ oder ein Projektname
//   anlegen({ art, titel, an, text, rang, dringend, anhaenge, entwurf })   neuer Eintrag
//   senden(sendung)                               Sendung aus dem Konflikt trotzdem senden (Trotzdem senden, Als Nachtrag senden)
//   erneut(sendung), verwerfen(sendung), rueckgaengig(sendung)
//
// Ergebnis jeder Einreihung: { ok: true, id } oder { ok: false, fehler } (das Werkzeug nähme die Eingabe nicht an) oder
// { ok: false, pruefung } (Geheimnis oder Personendaten gefunden; pruefung.geheimnisse und pruefung.personen nennen Ort
// und Art, nie den Wert). Mit `personenErlaubt` geht ein Text mit Personendaten durch (wie --allow-personal-data).
// Eine Sendung wartet zehn Sekunden (Rückgängig), ehe sie raus darf. Vor dem Senden gleicht der Schreiber ab (bedingte
// Anfrage, ETag) und prüft, ob die Frage inzwischen beantwortet, der Eintrag erledigt oder einsortiert ist.
//
// Sendung in der Warteschlange: { id, eintrag, art, zustand, zeit, sendenAb, von, dateien, nachricht, anhaenge, ... } mit
//   art      antwort | urteil | erledigt | einsortieren | anlegen
//   zustand  liegt | sendet | gesendet | konflikt | token | verboten | fehler    (Wörter: ansichtstexte.js schlangeZeile)
//   entwurf  { schluessel, wert }: was die Eingabe war; Rückgängig und Verwerfen legen sie zurück (UEI-6)
//   anhaenge die Anhänge der Eingabe (Base64); sie bleiben mit der Sendung auf dem Gerät, bis sie raus ist, und gehören zum
//            Entwurf anhaenge/SCHLÜSSEL, den Rückgängig zurücklegt
// Die Dateien einer Sendung stehen beim Einreihen fest (Stempel, ULIDs, ID): ein zweiter Versuch schreibt dieselben
// Pfade mit demselben Inhalt, ist also harmlos, falls der erste ankam und die App vor der Antwort endete.
import { adressText, sendungText, um } from './ansichtstexte.js';
import { anhangPfadVon } from './anhaenge.js';
import { anlegenDateien, antwortDateien, erledigtDateien, kurz, moeglichkeitenRoh, pruefeSendung, routeDateien, urteilDateien } from './dateien.js';
import { korrigierteZeit, merkeUhr, stempel, ulidErzeuger, zufallsbytes } from './erzeugen.js';
import { idMitStrich, ulidZeit } from './format.js';
import { uhrzeit } from './texte.js';
import { einstellung } from './speicher.js';
import { schreibTakt, sendeCommit } from './senden.js';
import { Fehler } from './urteil.js';
import { abnahmeSchritte, ladeWelt } from './welt.js';
import { absender, adressListe, finde, imEingang, umadressierungen, wirksamerKopf } from './zustand.js';

/** Der Satz, den Ansichten neben einen gesperrten Knopf stellen, wenn kein Schreiber da ist (nur in Tests; die App baut ihn immer). */
export const SENDEN_FEHLT = 'Senden ist hier nicht eingerichtet. Deine Eingabe bleibt auf diesem Gerät.';

/** Kann diese Fassung senden? */
export const kannSenden = (kontext) => Boolean(kontext?.schreiben);

/** So lange kann der Nutzer eine Sendung zurücknehmen (UDI-1, UDI-2). */
export const RUECKGAENGIG_MS = 10_000;
/** Nach einem Fehler, den ein späterer Versuch behebt, versucht der Schreiber es nach dieser Zeit wieder. */
export const WIEDER_MS = 60_000;
/** Ohne Netz fragt der Schreiber nach dieser Zeit wieder (wie die Steuerung des Abgleichs, UOF-4); Netz meldet ihn früher. */
export const NETZ_WIEDER_MS = 10_000;
/** Zustände, in denen die Sendung nicht weiterkommt, bis der Nutzer etwas tut. */
export const STECKT = ['konflikt', 'token', 'verboten', 'fehler'];

const geschlossen = (st) => st.status === 'done' || st.status === 'dropped';

/** Wann und von wem wurde der Eintrag zuletzt geschlossen? { ms, wort, von } oder null. */
function geschlossenSeit(e, st) {
  for (let i = e.events.length - 1; i >= 0; i--) {
    const ev = e.events[i];
    if (ev.type === 'status' && ['done', 'dropped'].includes(ev.doc.get('Status'))) {
      return { ms: ulidZeit(ev.ulid), wort: ev.doc.get('Status') === 'done' ? 'erledigt' : 'verworfen', von: absender(ev.doc) };
    }
  }
  return geschlossen(st) ? { ms: null, wort: st.status === 'done' ? 'erledigt' : 'verworfen', von: null } : null;
}

/**
 * Hat sich der Stand so geändert, dass die Sendung nicht mehr gilt? Ergebnis { titel, grund } oder null. Frage, Abnahme,
 * Erledigen und Einsortieren haben je einen Fall; Antworten auf Nachrichten und neue Einträge gehen immer durch.
 */
export function konfliktVon(welt, s) {
  if (s.art === 'anlegen') return null;
  const e = finde(welt.eintraege, s.eintrag);
  if (!e) return null;
  const st = welt.buch.zustand(e);
  const kind = e.head.get('Kind');
  const seit = (g) => (g.ms ? `${um(g.ms, welt.jetzt)} ` : '');
  if (s.art === 'antwort' && kind === 'question' && geschlossen(st)) {
    const g = geschlossenSeit(e, st);
    return { titel: 'Schon beantwortet', grund: `Die Frage ist ${seit(g)}${g.wort === 'verworfen' ? 'verworfen' : 'beantwortet'} worden${st.result ? ` (${kurz(st.result, 80)})` : ''}. Deine Antwort wurde nicht gesendet.` };
  }
  if (s.art === 'urteil') {
    if (geschlossen(st)) {
      const g = geschlossenSeit(e, st);
      return { titel: 'Schon beantwortet', grund: `Die Abnahme ist ${seit(g)}${g.wort === 'verworfen' ? 'verworfen' : 'beantwortet'} worden. Dein Urteil wurde nicht gesendet.` };
    }
    if (s.runde && abnahmeSchritte(e).runde !== s.runde) {
      return { titel: 'Schon beantwortet', grund: `Zu dieser Abnahme gibt es eine neue Runde. Dein Urteil gehörte zu Runde ${s.runde} und wurde nicht gesendet.` };
    }
  }
  if (s.art === 'erledigt' && geschlossen(st)) {
    const g = geschlossenSeit(e, st);
    return { titel: 'Schon erledigt', grund: `Der Eintrag ist ${seit(g)}${g.wort} worden. Dein Erledigt wurde nicht gesendet.` };
  }
  if (s.art === 'einsortieren') {
    if (geschlossen(st)) {
      const g = geschlossenSeit(e, st);
      return { titel: 'Schon erledigt', grund: `Der Eintrag ist ${seit(g)}${g.wort} worden. Dein Nachtrag wurde nicht gesendet.` };
    }
    if (!imEingang(e)) {
      const letzte = umadressierungen(e).at(-1);
      const wohin = adressText(adressListe(wirksamerKopf(e))) || 'ein neues Ziel';
      const zeit = letzte ? `${um(ulidZeit(letzte.ulid), welt.jetzt)} ` : '';
      return { titel: 'Schon einsortiert', grund: `Der Eintrag ist ${zeit}an ${wohin} adressiert worden. Dein Nachtrag an ${s.ziel === 'user' ? 'dich' : s.ziel} wurde nicht gesendet.` };
    }
  }
  return null;
}

/** Alle Pfade des Stands: die Dateien der Einträge und die Anhänge. */
const baumPfade = (baum) => new Set([...(baum?.eintraege ?? []).map((x) => x.pfad), ...(baum?.anhaenge ?? []).map(anhangPfadVon)]);

/** Ein Schreiber mit allem, was er braucht, als Parameter (Datenbank, fetch, Uhr, Abgleich), damit node --test ihn prüft. */
export class Schreiber {
  /**
   * @param {object} o
   * @param {object} o.db            Datenbank (speicher.js)
   * @param {Function} o.fetch       wie window.fetch
   * @param {()=>number} [o.jetzt]   Uhr des Geräts in ms
   * @param {()=>Promise<{ok:boolean, fehler?:object}>} o.abgleich   gleicht ab (bedingte Anfrage) und meldet das Ergebnis
   * @param {()=>Promise<object|null>} o.anmeldung   { repo, token } oder null
   * @param {(h:{text:string, rueckgaengig:()=>void, nicht?:string})=>void} [o.hinweis]  zeigt den Hinweis mit Rückgängig
   * @param {(text:string)=>boolean} [o.meldung]  zeigt einen Satz ohne Knopf; `false` heißt: gerade nicht möglich, später noch einmal
   * @param {()=>void} [o.beiAenderung]   sagt der Anzeige, dass sich die Warteschlange geändert hat
   * @param {object} [o.zeitgeber]   { setze(f, ms), loesche(t) }
   * @param {object} [o.takt]        schreibTakt(): Abstand der schreibenden Anfragen
   * @param {(n:number)=>Uint8Array} [o.zufall]
   */
  constructor({ db, fetch, jetzt = () => Date.now(), abgleich, anmeldung, hinweis = () => {}, meldung = () => true, beiAenderung = () => {},
    zeitgeber = { setze: (f, ms) => setTimeout(f, ms), loesche: (t) => clearTimeout(t) }, takt = schreibTakt(), zufall = zufallsbytes, rueckgaengigMs = RUECKGAENGIG_MS }) {
    Object.assign(this, { db, fetch, jetzt, abgleich, anmeldung, hinweis, meldung, beiAenderung, zeitgeber, takt, zufall, rueckgaengigMs });
    this.timer = null;
    this.laeuft = null;
    this.nochmal = false;
    this.nachgeholt = [];   // Sendungen, die gewartet hatten und jetzt raus sind; ein Hinweis meldet sie nach dem Lauf
  }

  // ---- Zeit und Kennungen

  /** Die Uhr, auf GitHubs Zeit umgerechnet (Uhrabweichung des Geräts). */
  zeit() { return korrigierteZeit(this.db, this.jetzt()); }

  async kontext(welt, ms) {
    const geraet = (await einstellung(this.db, 'geraet')) ?? 'handy';
    const vergeben = new Set();
    for (const e of welt.eintraege.values()) { vergeben.add(e.id); for (const a of e.head.getall('Alias')) vergeben.add(a); }
    for (const s of welt.schlange) if (s.eintrag) vergeben.add(s.eintrag);
    return { stempel: stempel(geraet, ms), ulid: ulidErzeuger(() => ms, this.zufall), vergeben, zufall: this.zufall, geraet };
  }

  // ---- Einreihen

  async einreihen(s, sendung, { entwurf = null, personenErlaubt = false, hinweisText }) {
    const pruefung = pruefeSendung(sendung);
    if (pruefung.geheimnisse.length || (pruefung.personen.length && !personenErlaubt)) return { ok: false, pruefung };
    const jetzt = this.jetzt();
    const eintrag = {
      ...s, id: `s${jetzt.toString(36)}${Array.from(this.zufall(3), (b) => b.toString(16).padStart(2, '0')).join('')}`,
      zustand: 'liegt', zeit: jetzt, sendenAb: jetzt + this.rueckgaengigMs, dateien: sendung.dateien, nachricht: sendung.nachricht,
      entwurf: entwurf ? { schluessel: entwurf.schluessel, wert: entwurf.wert ?? null } : null,
    };
    if (entwurf) { await this.db.entferne('entwuerfe', entwurf.schluessel); await this.db.entferne('entwuerfe', `anhaenge/${entwurf.schluessel}`); }
    await this.db.schreibe('schlange', eintrag);
    this.beiAenderung();
    this.hinweis({ text: hinweisText, rueckgaengig: () => this.rueckgaengig(eintrag.id) });
    this.plane();
    return { ok: true, id: eintrag.id };
  }

  /** Lädt die Welt und baut den Kontext; `id` ist der Eintrag, auf den sich die Sendung bezieht (oder null). */
  async vorbereiten(id) {
    const welt = await ladeWelt(this.db, this.jetzt());
    const e = id ? finde(welt.eintraege, id) : null;
    if (id && !e) throw new Fehler(`Ein Eintrag mit der ID ${idMitStrich(id)} liegt nicht auf diesem Gerät`, 1);
    return { welt, e, st: e ? welt.buch.zustand(e) : null, ctx: await this.kontext(welt, await this.zeit()) };
  }

  async versuche(f) {
    try { return await f(); } catch (e) {
      if (e instanceof Fehler) return { ok: false, fehler: e.message };
      throw e;
    }
  }

  antworten(id, { wahl = null, text = '', anhaenge = [], entwurf = null, personenErlaubt = false } = {}) {
    return this.versuche(async () => {
      const { e, ctx } = await this.vorbereiten(id);
      const sendung = antwortDateien(ctx, e, { wahl, text, anhaenge });
      const roh = wahl ? moeglichkeitenRoh(e).find((m) => m.wahl.toLowerCase() === String(wahl).toLowerCase()) : null;
      const bild = roh ? ` „${roh.wahl}“` : '';
      const n = anhaenge.length;
      const dazu = [String(text ?? '').trim() ? 'Text' : null, n ? `${n} ${n === 1 ? 'Anhang' : 'Anhängen'}` : null].filter(Boolean).join(' und ');
      return this.einreihen({ eintrag: e.id, art: 'antwort', wahl: roh?.wahl ?? null, text: String(text ?? '').trim(), anhaenge, von: ctx.geraet },
        sendung, { entwurf, personenErlaubt, hinweisText: `Antwort${bild}${dazu ? ` mit ${dazu}` : ''} gespeichert` });
    });
  }

  urteilSenden(id, { text, entwurf = null, personenErlaubt = false } = {}) {
    return this.versuche(async () => {
      const { e, st, ctx } = await this.vorbereiten(id);
      const sendung = urteilDateien(ctx, e, st, text);
      return this.einreihen({ eintrag: e.id, art: 'urteil', verdict: sendung.verdict, runde: sendung.runde, antwort: text, von: ctx.geraet },
        sendung, { entwurf, personenErlaubt, hinweisText: `Antwort zur Abnahme ${idMitStrich(e.id)} gespeichert` });
    });
  }

  erledigen(id, { entwurf = null } = {}) {
    return this.versuche(async () => {
      const { e, ctx } = await this.vorbereiten(id);
      return this.einreihen({ eintrag: e.id, art: 'erledigt', von: ctx.geraet }, erledigtDateien(ctx, e), { entwurf, hinweisText: `Eintrag ${idMitStrich(e.id)} als erledigt gespeichert` });
    });
  }

  einsortieren(id, { ziel, satz = '', entwurf = null, personenErlaubt = false } = {}) {
    return this.versuche(async () => {
      const { e, ctx } = await this.vorbereiten(id);
      const sendung = routeDateien(ctx, e, ziel === 'user' ? { to: ['user'], reason: satz } : { to: [`project:${ziel}`], project: ziel, reason: satz });
      return this.einreihen({ eintrag: e.id, art: 'einsortieren', ziel, satz: String(satz ?? '').trim(), von: ctx.geraet },
        sendung, { entwurf, personenErlaubt, hinweisText: `Eintrag ${idMitStrich(e.id)} ${ziel === 'user' ? 'an dich' : `an ${ziel}`} einsortiert.` });
    });
  }

  anlegen({ art, titel, an = null, text = '', rang = 2, dringend = false, anhaenge = [], entwurf = null, personenErlaubt = false }) {
    return this.versuche(async () => {
      const { ctx } = await this.vorbereiten(null);
      const sendung = anlegenDateien(ctx, { art, titel, an, text, rang, dringend, anhaenge });
      return this.einreihen({ eintrag: sendung.id, art: 'anlegen', neueArt: art, eintragTitel: String(titel).trim(), anhaenge, von: ctx.geraet },
        sendung, { entwurf, personenErlaubt, hinweisText: `Eintrag ${idMitStrich(sendung.id)} gespeichert` });
    });
  }

  // ---- Eingriffe des Nutzers

  sendung(id) { return this.db.lies('schlange', id); }

  /** Legt den Entwurf zurück, aus dem die Sendung entstand, und nimmt sie aus der Warteschlange. */
  async zuruecknehmen(id) {
    const s = await this.sendung(id);
    if (!s || s.zustand === 'gesendet' || s.zustand === 'sendet') return false;
    if (s.entwurf?.wert && !(await this.db.lies('entwuerfe', s.entwurf.schluessel))) {
      await this.db.schreibe('entwuerfe', { ...s.entwurf.wert, schluessel: s.entwurf.schluessel, zeit: this.jetzt() });
    }
    if (s.entwurf && s.anhaenge?.length && !(await this.db.lies('entwuerfe', `anhaenge/${s.entwurf.schluessel}`))) {
      await this.db.schreibe('entwuerfe', { anhaenge: s.anhaenge, schluessel: `anhaenge/${s.entwurf.schluessel}`, zeit: this.jetzt() });
    }
    await this.db.entferne('schlange', id);
    this.beiAenderung();
    return true;
  }

  /**
   * Entwurf verwerfen (Erfassen): Text und Anhänge des Entwurfs `schluessel` werden gelöscht, der Hinweis bietet zehn Sekunden
   * Rückgängig an. Rückgängig stellt beides wieder her, es sei denn, im Entwurf steht inzwischen wieder etwas.
   */
  async verwirfEntwurf(schluessel) {
    const anhangKey = `anhaenge/${schluessel}`;
    const text = await this.db.lies('entwuerfe', schluessel);
    const anhang = await this.db.lies('entwuerfe', anhangKey);
    if (!text && !anhang) return { ok: false };
    await this.db.entferne('entwuerfe', schluessel);
    await this.db.entferne('entwuerfe', anhangKey);
    this.beiAenderung();
    this.hinweis({
      text: 'Entwurf verworfen',
      nicht: 'Seitdem steht wieder etwas im Entwurf. Er bleibt, wie er ist.',
      rueckgaengig: async () => {
        if ((await this.db.lies('entwuerfe', schluessel)) || (await this.db.lies('entwuerfe', anhangKey))) return false;
        if (text) await this.db.schreibe('entwuerfe', text);
        if (anhang) await this.db.schreibe('entwuerfe', anhang);
        this.beiAenderung();
        return true;
      },
    });
    return { ok: true };
  }

  /** Rückgängig: solange die Sendung noch nicht unterwegs ist. */
  rueckgaengig(id) { return this.zuruecknehmen(id); }

  verwerfen(id) { return this.zuruecknehmen(id); }

  /** Trotzdem senden, Als Nachtrag senden: ohne Prüfung auf Konflikte, Antworten als reiner Nachtrag. */
  async senden(id) {
    const s = await this.sendung(id);
    if (!s || s.zustand === 'gesendet' || s.zustand === 'sendet') return false;
    const { titel, grund, ...rest } = s;
    await this.db.schreibe('schlange', { ...rest, zustand: 'liegt', trotzdem: true, gewartet: true, sendenAb: this.jetzt(), nichtVor: undefined });
    this.beiAenderung();
    this.plane();
    return true;
  }

  /** Erneut senden: nach einem neuen Token oder einem Fehler; die Prüfung auf Konflikte gilt weiter. */
  async erneut(id) {
    const s = await this.sendung(id);
    if (!s || !['token', 'verboten', 'fehler'].includes(s.zustand)) return false;
    const { grund, ...rest } = s;
    await this.db.schreibe('schlange', { ...rest, zustand: 'liegt', gewartet: true, sendenAb: this.jetzt(), nichtVor: undefined });
    this.beiAenderung();
    this.plane();
    return true;
  }

  /** Nach einer neuen Anmeldung: alles, was am Token scheiterte, geht noch einmal los. */
  async erneutAlle() {
    for (const s of await this.db.alle('schlange')) if (s.zustand === 'token' || s.zustand === 'verboten') await this.erneut(s.id);
  }

  /** Das Gerät meldet Netz oder der Abgleich gelang: was auf Netz wartet, geht jetzt los. */
  async weckeNetz() {
    for (const s of await this.db.alle('schlange')) {
      if (s.zustand === 'liegt' && s.warteArt === 'netz') await this.db.schreibe('schlange', { ...s, nichtVor: undefined, warteArt: undefined });
    }
    return this.lauf();
  }

  /** Beim Start: eine Sendung, die beim Beenden der App unterwegs war, liegt wieder (siehe Kopf: der zweite Versuch ist harmlos). */
  async aufraeumenBeimStart() {
    for (const s of await this.db.alle('schlange')) if (s.zustand === 'sendet') await this.db.schreibe('schlange', { ...s, zustand: 'liegt' });
    await this.raeume();
    this.beiAenderung();
    this.plane();
  }

  // ---- Senden

  /** Plant den nächsten Lauf: zur nächsten Sendung, die raus darf. */
  async plane() {
    this.zeitgeber.loesche(this.timer);
    this.timer = null;
    const liegt = (await this.db.alle('schlange')).filter((s) => s.zustand === 'liegt');
    if (!liegt.length) return;
    const faellig = Math.min(...liegt.map((s) => Math.max(s.sendenAb ?? 0, s.nichtVor ?? 0)));
    this.timer = this.zeitgeber.setze(() => { this.timer = null; this.lauf(); }, Math.max(0, faellig - this.jetzt()));
  }

  /** Sendet, was raus darf; läuft schon ein Lauf, wird danach noch einmal geprüft. */
  lauf() {
    if (this.laeuft) { this.nochmal = true; return this.laeuft; }
    this.laeuft = (async () => {
      try {
        do { this.nochmal = false; await this.laufEinmal(); } while (this.nochmal);
      } finally { this.laeuft = null; this.meldeNachgeholt(); await this.plane(); }
    })();
    return this.laeuft;
  }

  async setze(s, teil) {
    const neu = { ...s, ...teil };
    await this.db.schreibe('schlange', neu);
    this.beiAenderung();
    return neu;
  }

  async laufEinmal() {
    for (;;) {
      const jetzt = this.jetzt();
      const liste = (await this.db.alle('schlange')).filter((s) => s.zustand === 'liegt' && (s.sendenAb ?? 0) <= jetzt && (s.nichtVor ?? 0) <= jetzt)
        .sort((a, b) => (a.zeit ?? 0) - (b.zeit ?? 0));
      if (!liste.length) return;
      let wie;
      try { wie = await this.sendeEine(liste[0]); } catch (e) {
        // Ein Fehler im eigenen Code darf die Sendung nicht auf „wird gesendet“ stehen lassen
        const s = await this.sendung(liste[0].id);
        if (s) await this.setze(s, { zustand: 'fehler', grund: `Beim Senden ist ein Fehler aufgetreten (${String(e?.message ?? e)}).` });
        wie = 'halt';
      }
      if (wie === 'halt') return;
    }
  }

  /** Eine Sendung: abgleichen, auf Konflikte prüfen, Commit schreiben. Ergebnis 'weiter' oder 'halt' (nichts mehr versuchen). */
  async sendeEine(s0) {
    const quelle = await this.anmeldung();
    if (!quelle) return 'halt';
    let s = await this.setze(s0, { zustand: 'sendet' });
    const liegen = async (teil) => { await this.setze(s, { zustand: 'liegt', warteArt: undefined, gewartet: true, ...teil }); return 'halt'; };
    // Fehler des Abgleichs und des Sendens: netz und limit bleiben liegen, 401 wird zum Token, der Rest steht in der Zeile
    const behandle = async (f) => {
      if (f.art === 'netz' || f.art === 'abgebrochen') {
        // Einmal je Sendung sagen, dass sie auf Netz wartet: nach Ablauf von Rückgängig verschwindet sonst jedes Zeichen von ihr
        const wer = sendungText(s) || 'Die Sendung';
        const gesagt = s.netzGemeldet || this.meldung(`${wer} wartet auf Netz und geht raus, sobald du online bist.`) !== false;
        return liegen({ nichtVor: this.jetzt() + NETZ_WIEDER_MS, warteArt: 'netz', netzGemeldet: gesagt });
      }
      if (f.art === 'limit') return liegen({ nichtVor: f.bis ?? this.jetzt() + WIEDER_MS });
      if (f.art === 'token') { await this.setze(s, { zustand: 'token' }); return 'halt'; }
      if (f.art === 'verboten') { await this.setze(s, { zustand: 'verboten' }); return 'halt'; }
      if (f.art === 'nicht-gefunden') { await this.setze(s, { zustand: 'fehler', grund: 'GitHub findet das Repo nicht. Prüfe in Mehr, ob Repo und Token zusammenpassen.' }); return 'halt'; }
      if ((f.status ?? 0) >= 500 || f.art === 'intern') return liegen({ nichtVor: this.jetzt() + WIEDER_MS, grund: `GitHub antwortet mit Status ${f.status ?? '?'}.` });
      await this.setze(s, { zustand: 'fehler', grund: `GitHub lehnt die Sendung ab (${f.message ?? f.art}).` });
      return 'halt';
    };
    let dateien = s.dateien;
    let nachricht = s.nachricht;
    let schonDa = false;
    if (s.art !== 'anlegen') {
      const a = await this.abgleich();
      if (!a.ok) return behandle(a.fehler);
      const welt = await ladeWelt(this.db, this.jetzt());
      const baum = await this.db.lies('baum', 'stand');
      const pfade = baumPfade(baum);
      schonDa = Boolean(baum) && s.dateien.every((d) => pfade.has(d.pfad));
      if (!schonDa && !s.trotzdem) {
        const k = konfliktVon(welt, s);
        if (k) { await this.setze(s, { zustand: 'konflikt', ...k }); return 'weiter'; }
      } else if (!schonDa && (s.art === 'antwort' || s.art === 'urteil') && finde(welt.eintraege, s.eintrag)) {
        // Als Nachtrag senden: allein der Text, ohne Answer, Verdict und Status
        const { e, st, ctx } = await this.vorbereiten(s.eintrag);
        const neu = s.art === 'antwort'
          ? antwortDateien(ctx, e, { wahl: s.wahl, text: s.text, nachtrag: true, anhaenge: s.anhaenge ?? [] })
          : urteilDateien(ctx, e, st, s.antwort, { nachtrag: true });
        dateien = neu.dateien; nachricht = neu.nachricht;
      }
    }
    if (!schonDa) {
      try {
        const r = await sendeCommit({ fetch: this.fetch, quelle: { repo: quelle.repo, token: quelle.token, zweig: quelle.zweig ?? 'main' }, dateien, nachricht, takt: this.takt, jetzt: this.jetzt });
        await merkeUhr(this.db, r.serverzeit, this.jetzt());
        s = await this.setze(s, { zustand: 'gesendet', zeit: this.jetzt(), dateien, commit: r.commit });
      } catch (e) {
        if (e?.name !== 'AbgleichFehler') throw e;
        return behandle(e);
      }
    } else {
      s = await this.setze(s, { zustand: 'gesendet', zeit: this.jetzt() });
    }
    if (s0.gewartet) this.nachgeholt.push({ wer: sendungText(s), zeit: s.zeit });
    // Danach gleicht der Schreiber ab: die Dateien stehen dann im Stand, und die Sendung verlässt die Warteschlange
    const a = await this.abgleich();
    if (a.ok) await this.raeume();
    return 'weiter';
  }

  /** Nach einem Lauf: was gewartet hatte und jetzt raus ist, meldet ein Hinweis mit der Uhrzeit (das Band verschwindet sonst ohne Wort). */
  meldeNachgeholt() {
    const fertig = this.nachgeholt.splice(0);
    if (!fertig.length) return;
    const um = uhrzeit(fertig.at(-1).zeit);
    this.meldung(fertig.length === 1 ? `${fertig[0].wer || 'Die Sendung'} gesendet um ${um}.` : `${fertig.length} Sendungen gesendet um ${um}.`);
  }

  /** Entfernt gesendete Sendungen, deren Dateien der Abgleich schon kennt. */
  async raeume() {
    const baum = await this.db.lies('baum', 'stand');
    if (!baum) return;
    const pfade = baumPfade(baum);
    let geaendert = false;
    for (const s of await this.db.alle('schlange')) {
      if (s.zustand === 'gesendet' && s.dateien?.length && s.dateien.every((d) => pfade.has(d.pfad))) { await this.db.entferne('schlange', s.id); geaendert = true; }
    }
    if (geaendert) this.beiAenderung();
  }
}
