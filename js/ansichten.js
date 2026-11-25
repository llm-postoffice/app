// Die Listen: Wartet, Abnahmen, Eingang, Ideensammlung und Suche. Jede Funktion bekommt die Welt (welt.js) und den
// Zustand des Abgleichs und gibt Knoten zurück; alle Zustände aus dem Entwurf haben hier einen Ort: lädt, Fehler, leer,
// gefüllt, dazu das Band bei Token abgelaufen. Text aus Einträgen geht nur über el() in den Baum (USI-1).
import { el } from './dom.js';
import { abnahmenNachRechner, eingangListe, ideenListe, karteVon, suche, wartetListe, zaehler } from './welt.js';
import { abnahmen as abnahmenText, schritte as schritteText, um, zeitpunkt } from './ansichtstexte.js';
import { schlangeBandKnoten } from './schlange.js';
import { band, chipDringend, gruppentitel, karten, knopf, linkKnopf, platz, ruhigeKarte, uebersicht } from './karten.js';
import { fristKnoten } from './frist.js';
import { fehlerAnzeige, fortschrittAnzeige, uhrzeit } from './texte.js';

const BILD_TON = { ruhig: 'blau', warnung: 'warn', fehler: 'fehler' };
const BAND_TON = { ruhig: 'info', warnung: 'warn', fehler: 'fehler' };

/**
 * Die Zeilen unter der Zahl: erst der Stand des Abgleichs („Abgeglichen um 14:07“, „Gleicht gerade ab …“, mit Fehler „Stand von
 * 13:50, seitdem nicht abgeglichen“, ohne Netz „Zuletzt abgeglichen …“), dann was als Nächstes kommt: der nächste Abgleich mit
 * Frist, beim nächsten Netz oder nur von Hand. Es sind immer zwei Zeilen (beim Fehler, den nur du beheben kannst, eine): der
 * Wechsel zwischen den Zuständen ändert die Höhe nicht und schiebt nichts unter dem Finger. Ohne Stand eine leere Liste.
 */
export function standZeile(z, jetzt) {
  const letzter = z.letzter?.geprueft;
  if (!letzter) return [];
  const wann = um(letzter, jetzt);
  const frist = (text) => [text, ' ', fristKnoten(z.naechster, jetzt)];
  if (z.phase === 'laeuft') return ['Gleicht gerade ab …', `Zuletzt abgeglichen ${wann}`];
  if (z.ohneNetz) return [`Zuletzt abgeglichen ${wann}`, 'Beim nächsten Netz gleicht die App ab.'];
  if (z.phase === 'fehler') return [`Stand von ${uhrzeit(letzter)}, seitdem nicht abgeglichen`, ...(z.naechster ? [frist('Nächster Versuch')] : [])];
  if (z.naechster) return [`Abgeglichen ${wann}`, frist('Nächster Abgleich')];
  return [`Abgeglichen ${wann}`, ...(z.fertig ? ['Der nächste Abgleich läuft nur von Hand.'] : [])];
}

/** Knöpfe zu einem Fehler des Abgleichs: Erneut versuchen oder Neues Token eintragen (E7). */
export function fehlerKnoepfe(a, k) {
  if (a.aktion === 'erneut') return [knopf('Erneut versuchen', { an: () => k.steuerung.jetztAbgleichen() })];
  if (a.aktion === 'token') return [linkKnopf('Neues Token eintragen', '#anmelden', { klasse: 'tonal' })];
  return [];
}

/**
 * Was die Ansicht zeigt, solange das Gerät noch keinen Stand hat: lädt oder Fehler (UFA-10); sonst null. `name` ist der
 * Gegenstand im Titel („Einträge“, „Eingang“, „Ideen“).
 */
export function ohneStand(welt, z, k, { geladen, nichtGeladen }) {
  if (welt.hatStand) return null;
  if (z.phase === 'fehler' && z.fehler) {
    const a = fehlerAnzeige(z.fehler, null);
    const eigen = z.fehler.art === 'antwort' || z.fehler.art === 'intern';
    return [platz({
      bild: z.fehler.art === 'netz' ? 'blau' : (BILD_TON[a.ton] ?? 'fehler'), symbol: z.fehler.art === 'netz' ? 'cloud_off-f' : null,
      titel: eigen ? nichtGeladen : a.titel,
      saetze: [a.satz.replace('Auf diesem Gerät gibt es noch keinen Stand.', 'Dieses Gerät hat noch keine Einträge gespeichert. Sobald GitHub wieder antwortet, lädt die App sie.')],
      knoepfe: fehlerKnoepfe(a, k), einzelheiten: a.einzelheiten,
    })];
  }
  const f = fortschrittAnzeige(z.phase === 'laeuft' ? z.fortschritt : null);
  return [platz({
    bild: 'blau', titel: geladen,
    saetze: ['Beim ersten Mal lädt die App alle Einträge auf dieses Gerät. Danach holt sie die neuen Einträge.'],
    fortschritt: { max: f.max, wert: f.wert, text: f.text, beschriftung: geladen },
    neben: ['Du kannst die App schließen. Beim nächsten Öffnen geht der Abgleich dort weiter, wo er stand.'],
  })];
}

/** Band oben, wenn der Abgleich mit Stand scheitert (Token, Zugriff, Repo): Netz und Limit sagt schon die ruhige Zeile oben. */
export function fehlerBand(welt, z, k) {
  if (!welt.hatStand || z.phase !== 'fehler' || !z.fehler || z.fehler.art === 'netz') return null;
  const a = fehlerAnzeige(z.fehler, z.letzter?.geprueft ?? null);
  return band({ ton: BAND_TON[a.ton], symbol: a.symbol, titel: a.titel, satz: a.satz, knoepfe: fehlerKnoepfe(a, k) });
}

const eingangKarte = (n) => ruhigeKarte({ symbol: 'inbox-f', titel: 'Eingang', zeile: `${n} ${n === 1 ? 'Eintrag' : 'Einträge'} zum Einsortieren`, href: '#eingang' });
const hinweisSendung = (welt, liste) => {
  const n = liste.filter(({ e }) => welt.schlange.some((s) => s.eintrag === e.id && s.zustand !== 'gesendet')).length;
  return n ? el('p', { class: 'neben' }, n === 1 ? 'Einer davon ist noch nicht gesendet.' : `${n === 2 ? 'Zwei' : n} davon sind noch nicht gesendet.`) : null;
};

/** Wartet auf dich: Übersicht, Karten nach Rang, darunter der Eingang. */
export function wartet(welt, z, k) {
  const platzhalter = ohneStand(welt, z, k, { geladen: 'Einträge werden geladen', nichtGeladen: 'Einträge nicht geladen' });
  if (platzhalter) return platzhalter;
  const liste = wartetListe(welt);
  const c = zaehler(welt);
  const stand = standZeile(z, welt.jetzt);
  const unten = c.eingang ? [el('ul', { class: 'karten' }, eingangKarte(c.eingang))] : [];
  const oben = [fehlerBand(welt, z, k), schlangeBandKnoten(welt, z)];
  if (!liste.length) {
    return [...oben, platz({
      bild: 'ok', titel: 'Nichts für dich',
      saetze: ['Neue Fragen, Freigaben und Abnahmen erscheinen hier. Schalte in Mehr die Mitteilungen ein, dann meldet sie dir der Browser, sobald sie ankommen.'],
      knoepfe: [linkKnopf('Etwas erfassen', '#erfassen')], neben: stand,
    }), ...unten];
  }
  return [...oben, uebersicht({ n: liste.length, wort: 'für dich', chips: c.dringend ? [chipDringend(`davon ${c.dringend} dringend`)] : [], neben: stand }),
    karten(liste.map((x) => karteVon(welt, x, { ohneNetz: z.ohneNetz })), (m) => `#eintrag/${m.id}`), ...unten];
}

/** Abnahmen, nach Rechner gruppiert; je Gruppe die Zahl der offenen Schritte und das Alter der ältesten. */
export function abnahmen(welt, z, k) {
  const platzhalter = ohneStand(welt, z, k, { geladen: 'Abnahmen werden geladen', nichtGeladen: 'Abnahmen nicht geladen' });
  if (platzhalter) return platzhalter;
  const c = zaehler(welt);
  const stand = standZeile(z, welt.jetzt);
  const oben = [fehlerBand(welt, z, k)];
  if (!c.abnahmen) {
    return [...oben, platz({
      bild: 'ok', symbol: 'checklist-f', titel: 'Keine Abnahmen',
      saetze: ['Abnahmen, die auf dein Urteil warten, erscheinen hier. Du beurteilst jeden Schritt einzeln.'], neben: stand,
    })];
  }
  const gruppen = abnahmenNachRechner(welt);
  const teile = [...oben, uebersicht({
    n: c.abnahmen, wort: c.abnahmen === 1 ? 'Abnahme' : 'Abnahmen',
    neben: [`${schritteText(c.offeneSchritte)} offen`, ...stand],
  })];
  for (const g of gruppen) {
    const offen = g.offen === 1 ? '1 Schritt' : `${g.offen} Schritte`;
    teile.push(gruppentitel(`${g.host ?? 'ohne Rechner'} · ${abnahmenText(g.eintraege.length)} · ${offen} offen, die älteste wartet seit ${zeitpunkt(g.aelteste, welt.jetzt)}`));
    teile.push(karten(g.eintraege.map((x) => karteVon(welt, x, { ohneNetz: z.ohneNetz })), (m) => `#eintrag/${m.id}`));
  }
  return teile;
}

/** Eingang: Einträge ohne Ziel, neueste zuerst; Einsortieren steht im Eintrag. */
export function eingang(welt, z, k) {
  const platzhalter = ohneStand(welt, z, k, { geladen: 'Eingang wird geladen', nichtGeladen: 'Eingang nicht geladen' });
  if (platzhalter) return platzhalter;
  const liste = eingangListe(welt);
  const stand = standZeile(z, welt.jetzt);
  const oben = [fehlerBand(welt, z, k)];
  if (!liste.length) {
    return [...oben, platz({ bild: 'ok', titel: 'Alles einsortiert', saetze: ['Einträge ohne Ziel erscheinen hier, bis du sie einsortierst.'], neben: stand })];
  }
  return [...oben, uebersicht({
    n: liste.length, wort: 'zum Einsortieren',
    neben: ['Einträge ohne Ziel. Mit Einsortieren bekommen sie ein Projekt, oder sie gehen an dich.', ...stand],
  }), hinweisSendung(welt, liste),
  karten(liste.map((x) => karteVon(welt, x, { ohneNetz: z.ohneNetz })), (m) => `#eintrag/${m.id}`),
  el('p', { class: 'neben' }, 'Tippe auf einen Eintrag, um ihn zu lesen und einzusortieren.')];
}

/** Ideensammlung: Ideen an dich, die nicht auf dich warten; neueste zuerst. */
export function ideen(welt, z, k) {
  const platzhalter = ohneStand(welt, z, k, { geladen: 'Ideen werden geladen', nichtGeladen: 'Ideen nicht geladen' });
  if (platzhalter) return platzhalter;
  const liste = ideenListe(welt);
  const stand = standZeile(z, welt.jetzt);
  const oben = [fehlerBand(welt, z, k)];
  if (!liste.length) {
    return [...oben, platz({
      bild: 'nachricht', titel: 'Keine Ideen', saetze: ['Ideen, die Sitzungen für dich festhalten, erscheinen hier. Sie warten nicht auf dich.'],
      knoepfe: [linkKnopf('Idee erfassen', '#erfassen')], neben: stand,
    })];
  }
  return [...oben, uebersicht({
    n: liste.length, wort: liste.length === 1 ? 'Idee' : 'Ideen',
    neben: ['Ideen, die Sitzungen für dich festhalten. Sie warten nicht auf dich.', 'Neueste zuerst.', ...stand],
  }), hinweisSendung(welt, liste),
  karten(liste.map((x) => karteVon(welt, x, { ohneNetz: z.ohneNetz })), (m) => `#eintrag/${m.id}`)];
}

/** Suche: Eingabe oben in der Leiste; hier der Zustand dazu: Start, Treffer, nichts gefunden. */
export function sucheAnsicht(welt, z, k, eingabe) {
  const platzhalter = ohneStand(welt, z, k, { geladen: 'Einträge werden geladen', nichtGeladen: 'Einträge nicht geladen' });
  if (platzhalter) return platzhalter;
  const q = String(eingabe ?? '').trim();
  if (!q) {
    return [platz({
      bild: 'blau', symbol: 'search', titel: 'Suchen',
      saetze: ['Suche nach Titel oder ID, auch in erledigten und verworfenen Einträgen. Die ID gilt mit oder ohne Strich.'],
    })];
  }
  const r = suche(welt, q);
  if (!r.gesamt) {
    return [platz({
      bild: 'blau', symbol: 'search_off-f', titel: 'Nichts gefunden',
      saetze: [`Kein Eintrag mit „${q}“ in Titel oder ID. Prüfe die ID oder gleiche in Mehr ab.`],
    })];
  }
  const zahl = r.gesamt === 1 ? '1 Treffer' : `${r.gesamt} Treffer`;
  const mehr = r.gesamt > r.treffer.length ? ` Die ersten ${r.treffer.length} stehen hier; verfeinere die Eingabe.` : '';
  return [el('p', { class: 'neben', role: 'status' }, `${zahl} für „${q}“. Die Suche versteht eine ID mit und ohne Strich.${mehr}`),
    karten(r.treffer.map((x) => karteVon(welt, x, { ohneNetz: z.ohneNetz })), (m) => `#eintrag/${m.id}`)];
}
