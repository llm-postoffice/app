// Entscheidungen des Service Workers, rein und ohne Browser (UOF-1, UOF-5): sw.js und die App laden dieses Modul, node --test
// prüft es. Der Service Worker ist ein Modul (`register('./sw.js', { type: 'module' })`), damit er es importieren kann.

/** Alle Cache-Namen der App beginnen so; fremde Caches desselben Ursprungs fasst der Service Worker nie an. */
export const CACHE_VORSATZ = 'postfach-';

/** Die Caches, die nach dem Wechsel zur Fassung `aktuell` gelöscht werden: alle früheren Fassungen der App. */
export const veralteteCaches = (schluessel, aktuell) => schluessel.filter((k) => k.startsWith(CACHE_VORSATZ) && k !== aktuell);

/**
 * Wartet eine neue Fassung auf die Freigabe des Nutzers? Nur wenn sie schon fertig installiert ist (`waiting`) und die Seite
 * von einer früheren Fassung gesteuert wird (`controller`): beim ersten Besuch gibt es nichts zu wechseln.
 */
export const aktualisierungWartet = ({ waiting, controller }) => Boolean(waiting && controller);

/** Der Nutzer will wechseln: nur die Nachricht „wechseln“ gibt den wartenden Service Worker frei. */
export const WECHSELN = 'wechseln';
export const gibtFrei = (daten) => daten === WECHSELN;

// ---- Web-Push als Probe --------------------------------------------------------------------------------------------------
// Das Postwerkzeug sendet den Push ohne Nutzlast (claude-post webpush: nur die VAPID-Kopfzeile, keine Verschlüsselung). Der
// Service Worker zeigt darum immer denselben Hinweis, und ein Tipp öffnet Wartet. Die Anzahl neuer Einträge kennt er nicht: der
// Speicher auf dem Gerät hat nur den Stand des letzten Abgleichs, und das Token liegt dort, wo ein Push nicht abgleichen soll.
// Trüge ein Push doch eine Nutzlast `{"ziel":"#eintrag/ID"}`, öffnet der Tipp diesen Eintrag; jede andere Nutzlast gilt nicht.
// Titel höchstens 30 und Text höchstens 40 Zeichen, nichts Vertrauliches im Hinweis.
export const PUSH_HINWEIS = { titel: 'LLM-Post', text: 'Neue Einträge für dich', tag: 'llm-post-neu', ziel: './#wartet' };

/** Erlaubte Ziele eines Tipps: Wartet, Abnahmen oder ein Eintrag (die ID mit oder ohne Strich). Alles andere fällt auf Wartet. */
const ZIEL_MUSTER = /^#(?:wartet|abnahmen|eintrag\/[A-Za-z0-9-]{1,32})$/;

/** Das Ziel aus dem Text der Nutzlast; ohne gültige Angabe das von Wartet. Der Text darf leer oder kein JSON sein. */
export function pushZiel(text) {
  try {
    const ziel = JSON.parse(text)?.ziel;
    if (typeof ziel === 'string' && ZIEL_MUSTER.test(ziel)) return `./${ziel}`;
  } catch { /* keine Nutzlast oder kein JSON: der feste Hinweis */ }
  return PUSH_HINWEIS.ziel;
}

/** Die Optionen für showNotification: ein neuer Push ersetzt den alten Hinweis (tag) und meldet sich wieder (renotify). */
export const hinweisOptionen = (icon, ziel = PUSH_HINWEIS.ziel) => ({ body: PUSH_HINWEIS.text, tag: PUSH_HINWEIS.tag, renotify: true, icon, data: { ziel } });

/** Welches offene Fenster holt ein Tipp auf den Hinweis nach vorn? Ein sichtbares, sonst das erste; null: ein neues öffnen. */
export const fensterWaehlen = (fenster) => fenster.find((f) => f.visibilityState === 'visible') ?? fenster[0] ?? null;

/** Das Ziel eines Hinweises aus seinen Daten; ein fremder oder fehlender Wert fällt auf Wartet. */
export const klickZiel = (daten) => (typeof daten?.ziel === 'string' && ZIEL_MUSTER.test(daten.ziel.replace(/^\.\//, '')) ? daten.ziel : PUSH_HINWEIS.ziel);

/** Gültiges Ziel (`#wartet`, `#abnahmen`, `#eintrag/ID`) oder Wartet. */
export const gueltigesZiel = (ziel) => (typeof ziel === 'string' && ZIEL_MUSTER.test(ziel) ? ziel : '#wartet');

/** Die Nachricht an ein offenes Fenster und die Kennung der Adresse eines neuen: beide sagen der App, dass ein Tipp kam und sie vor dem Öffnen abgleichen soll. */
export const PUSH_KLICK = 'push-klick';
export const PUSH_FRAGE = 'push';

/** Das Ziel aus der Nachricht eines Tipps; `null`, wenn die Nachricht keiner ist. */
export const zielAusNachricht = (daten) => (daten?.art === PUSH_KLICK ? gueltigesZiel(daten.ziel) : null);

/**
 * Was tut ein Tipp: ein offenes Fenster nach vorn holen und ihm das Ziel melden, sonst ein neues öffnen. Beide Wege führen in die App,
 * die zuerst abgleicht und dann öffnet (js/pushklick.js): das Fenster bekommt eine Nachricht (kein Neuladen, kein Verlust im Fenster),
 * das neue Fenster eine Adresse mit `?push`. `basis` ist der Bereich des Service Workers; daraus wird die Adresse absolut
 * (openWindow verlangt den eigenen Ursprung).
 */
export function klickPlan(fenster, daten, basis) {
  const ziel = klickZiel(daten);
  const kurz = ziel.replace(/^\.\//, '');
  const f = fensterWaehlen(fenster);
  if (f) return { art: 'fenster', fenster: f, nachricht: { art: PUSH_KLICK, ziel: kurz } };
  const adresse = new URL(ziel, basis);
  adresse.search = `?${PUSH_FRAGE}`;
  return { art: 'neu', adresse: adresse.href };
}
