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

// ---- Web-Push als Probe (Auftrag phzd86) ---------------------------------------------------------------------------------
// Der Push trägt keinen Text; der Service Worker zeigt immer denselben Hinweis. Die Anzahl neuer Einträge kennt er nicht: der
// Speicher auf dem Gerät hat nur den Stand des letzten Abgleichs, und das Token liegt dort, wo ein Push nicht abgleichen soll.
// Titel höchstens 30 und Text höchstens 40 Zeichen (UMI-2); der Hinweis nennt nichts Vertrauliches (UMI-5).
export const PUSH_HINWEIS = { titel: 'Postfach', text: 'Neue Einträge für dich', tag: 'postfach-neu', ziel: './#wartet' };

/** Die Optionen für showNotification: ein neuer Push ersetzt den alten Hinweis (tag) und meldet sich wieder (renotify). */
export const hinweisOptionen = (icon) => ({ body: PUSH_HINWEIS.text, tag: PUSH_HINWEIS.tag, renotify: true, icon, data: { ziel: PUSH_HINWEIS.ziel } });

/** Welches offene Fenster holt ein Tipp auf den Hinweis nach vorn? Ein sichtbares, sonst das erste; null: ein neues öffnen. */
export const fensterWaehlen = (fenster) => fenster.find((f) => f.visibilityState === 'visible') ?? fenster[0] ?? null;
