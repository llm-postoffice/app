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
