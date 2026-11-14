// Netz (UOF-4): ohne Netz ist ein Zustand, kein Fehler; eine ruhige Zeile oben nennt ihn. Das Gerüst kennt nur
// die Meldung des Geräts. Mit dem Abgleich (Teil C) gilt auch als offline, wer am Netz scheitert, und die App
// fragt dann alle 10 s erneut, weil mit einem VPN kein Ereignis online kommt.

export function netzZeile(zeile) {
  const setzen = () => { zeile.hidden = navigator.onLine; };
  addEventListener('online', setzen);
  addEventListener('offline', setzen);
  setzen();
}
