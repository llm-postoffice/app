// Die Warteschlange für den Nutzer: ein Band oben in Wartet („4 Sendungen noch nicht gesendet“, solange etwas auf Netz wartet oder
// hängt) und die Seite „Noch nicht gesendet“ (`#schlange`) mit einer Zeile je Sendung: was, zu welchem Eintrag, in welchem
// Zustand und was hilft (Erneut senden, Neues Token eintragen, Trotzdem senden, Verwerfen). Wartendes geht von selbst raus; was
// hängt, braucht den Nutzer. Ein neuer Eintrag, den dieses Gerät angelegt hat, steht über seine Zeile offen (welt.js legt ihn in
// die Welt, sobald er in der Schlange liegt). Gewählt wurde die Variante A (Entwürfe: docs/entwicklung/ansichten/warteschlange).
import { el, ico } from './dom.js';
import { schlangeBand, sendungText, sendungZustand } from './ansichtstexte.js';
import { fristKnoten } from './frist.js';
import { idMitStrich } from './format.js';
import { band, chipZustand, knopf, linkKnopf, platz } from './karten.js';
import { kannSenden, SENDEN_FEHLT } from './schreiben.js';
import { offeneSendungen, sendungBereit, sendungHaengt, sendungLaeuft, sendungRaus } from './welt.js';
import { finde } from './zustand.js';

/** Der Satz nach Verwerfen: die Eingabe liegt wieder als Entwurf da, wenn sie aus einem Entwurf kam. */
const verworfenSatz = (s) => (s.entwurf ? 'Verworfen. Deine Eingabe liegt wieder als Entwurf auf diesem Gerät.' : 'Verworfen.');

/** Der Knopf Verwerfen einer Sendung; `ziel` ist die Adresse, die danach öffnet, wenn die Ansicht sonst leer wäre (neuer Eintrag). */
export function verwerfenKnopf(s, k, { ziel = null } = {}) {
  const b = knopf('Verwerfen', { klasse: 'text', gesperrt: !kannSenden(k), an: async () => {
    await k.schreiben.verwerfen(s.id);
    k.meldung?.(verworfenSatz(s));
    if (ziel) k.ersetze(ziel); else k.neuZeichnen();
  } });
  b.dataset.handlung = 'verwerfen';
  return b;
}

/** Das Band oben in Wartet; `null`, wenn nichts auf Netz wartet, nichts läuft und nichts hängt. */
export function schlangeBandKnoten(welt, z) {
  const offen = offeneSendungen(welt, { ohneNetz: z.ohneNetz });
  if (!offen.length) return null;
  const haengend = offen.filter(sendungHaengt);
  const sendet = offen.filter(sendungLaeuft);
  const gesendet = offen.filter((s) => sendungRaus(welt, s));
  const rest = offen.filter((s) => !haengend.includes(s) && !sendet.includes(s) && !gesendet.includes(s));
  const gleich = rest.filter((s) => sendungBereit(welt, s) && !z.ohneNetz);
  const netz = rest.filter((s) => !gleich.includes(s) && (z.ohneNetz || s.warteArt === 'netz'));
  const spaeter = rest.filter((s) => !gleich.includes(s) && !netz.includes(s));
  const fristen = spaeter.map((s) => s.nichtVor ?? 0).filter((ms) => ms > welt.jetzt);
  const t = schlangeBand({ netz: netz.length, spaeter: spaeter.length, gleich: gleich.length, haengend: haengend.length, sendet: sendet.length, gesendet: gesendet.length,
    bis: fristen.length ? Math.min(...fristen) : null, zeit: gesendet.length ? Math.max(...gesendet.map((s) => s.zeit ?? 0)) : null });
  const satz = t.frist ? [[`${t.satz} `, t.frist.text, ' ', fristKnoten(t.frist.bis, welt.jetzt), '.']] : t.satz;
  const nurRaus = offen.length === gesendet.length;
  return band({ ton: nurRaus ? 'ok' : 'warn', symbol: nurRaus ? 'check_circle-f' : 'cloud_upload-f', titel: t.titel, satz, knoepfe: [linkKnopf('Anzeigen', '#schlange', { klasse: 'tonal' })] });
}

/** Die Knöpfe einer Zeile je nach Zustand: erst, was weiterhilft, zuletzt Verwerfen. */
function knoepfeVon(s, k) {
  const aktion = (text, was, klasse = 'tonal') => {
    const b = knopf(text, { klasse, gesperrt: !kannSenden(k), an: async () => { await k.schreiben[was](s.id); k.neuZeichnen(); } });
    b.dataset.handlung = was === 'erneut' ? 'erneut' : 'senden';
    return b;
  };
  const liste = [];
  if (s.zustand === 'token' || s.zustand === 'verboten') liste.push(linkKnopf('Neues Token eintragen', '#anmelden'));
  else if (s.zustand === 'fehler') liste.push(aktion('Erneut senden', 'erneut'));
  else if (s.zustand === 'konflikt') liste.push(aktion(s.art === 'einsortieren' ? `Trotzdem an ${s.ziel === 'user' ? 'dich' : s.ziel} senden` : 'Als Nachtrag senden', 'senden'));
  liste.push(verwerfenKnopf(s, k));
  return liste;
}

function zeile(welt, z, k, s) {
  const e = finde(welt.eintraege, s.eintrag);
  const titel = e?.head.title ?? s.eintragTitel ?? `Eintrag ${idMitStrich(s.eintrag)}`;
  const zst = sendungZustand(s, { ohneNetz: z.ohneNetz, jetzt: welt.jetzt });
  return el('li', { class: `sendung${sendungHaengt(s) ? ' haengt' : ''}` },
    el('a', { class: 'sendung-kopf', href: `#eintrag/${s.eintrag}` },
      el('span', { class: 'sendung-was' }, sendungText(s)), el('b', {}, titel), ico('chevron_right')),
    chipZustand(zst),
    zst.satz ? el('p', { class: 'sendung-satz' }, zst.satz) : null,
    el('div', { class: 'zeilenknoepfe' }, knoepfeVon(s, k)));
}

/** Die Seite „Noch nicht gesendet“. */
export function schlangeAnsicht(welt, z, k) {
  const liste = offeneSendungen(welt, { ohneNetz: z.ohneNetz });
  if (!liste.length) {
    return [platz({ bild: 'ok', titel: 'Alles gesendet', saetze: ['Nichts wartet auf Netz und nichts hängt. Neue Eingaben gehen nach zehn Sekunden raus.'] })];
  }
  return [
    el('p', { class: 'neben' }, 'Was wartet, geht von selbst raus. Was hängt, braucht dich. Verwerfen nimmt eine Sendung zurück: deine Eingabe liegt dann wieder als Entwurf auf diesem Gerät.'),
    kannSenden(k) ? null : el('p', { class: 'neben satz' }, SENDEN_FEHLT),
    el('ul', { class: 'sendungen' }, liste.map((s) => zeile(welt, z, k, s))),
  ];
}
