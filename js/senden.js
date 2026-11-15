// Senden: eine Sendung ist ein Commit im Datenrepo, geschrieben über die Git-Data-API von GitHub (kein Klon, kein Git auf dem
// Gerät). Ablauf: Kopf des Zweigs lesen, je Datei einen Blob anlegen, einen Baum auf dem Baum des Kopfs (base_tree), einen
// Commit mit dem Kopf als Elternteil und den Zweig dorthin verschieben, ohne force. Weil nur neue Dateien dazukommen,
// gibt es keinen Merge-Konflikt. Hat inzwischen jemand anderes gepusht (Status 409 oder 422 beim Verschieben des
// Zweigs), baut die App Baum und Commit auf dem neuen Kopf neu auf; die Blobs bleiben.
// GitHub verlangt mindestens eine Sekunde zwischen zwei schreibenden Anfragen; eine Sendung hat darum mindestens vier
// Sekunden (drei Blobs und der Rest kommen dazu). Fetch, Uhr und Warten sind Parameter, damit node --test sie prüft.
import { API, AbgleichFehler, antwortFehler } from './abgleich.js';

export const SCHREIBABSTAND_MS = 1000;
/** So oft baut die App auf einem bewegten Zweig neu auf, bevor sie aufgibt. */
export const NEUBAU_MAX = 5;
const REPO_RE = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const ZWEIG_RE = /^[A-Za-z0-9_./-]+$/;

/** Ein Taktgeber für schreibende Anfragen: hält den Abstand ein, auch über Sendungen hinweg. */
export function schreibTakt({ uhr = () => performance.now(), warte = (ms) => new Promise((r) => setTimeout(r, ms)), abstand = SCHREIBABSTAND_MS } = {}) {
  let letzte = null;
  return {
    async vorSchreiben() {
      if (letzte !== null) {
        const rest = letzte + abstand - uhr();
        if (rest > 0) await warte(rest);
      }
    },
    nachSchreiben() { letzte = uhr(); },
  };
}

/**
 * Schreibt `dateien` ([{ pfad, inhalt }], Text) als einen Commit auf den Zweig. Parameter:
 *   fetch    wie window.fetch
 *   quelle   { repo: 'EIGENTÜMER/NAME', token, zweig: 'main' }
 *   dateien  neue Dateien; ein Pfad, der es schon gibt, wäre überschrieben: die ULIDs und IDs machen das unmöglich
 *   nachricht  Text des Commits
 *   takt     schreibTakt()
 *   bei(zustand)  meldet { phase: 'kopf' | 'blobs' | 'baum' | 'commit' | 'zweig', versuch }
 * Ergebnis: { commit, versuche, serverzeit } (serverzeit: Date-Kopf der letzten Antwort in ms oder null).
 * Fehler: AbgleichFehler mit art token, limit, verboten, nicht-gefunden, netz, antwort, einstellung.
 */
export async function sendeCommit({ fetch, quelle, dateien, nachricht, takt = schreibTakt(), jetzt = () => Date.now(), bei = () => {}, signal }) {
  const m = REPO_RE.exec(quelle?.repo ?? '');
  const zweig = quelle?.zweig ?? 'main';
  if (!m || !ZWEIG_RE.test(zweig) || !quelle.token) throw new AbgleichFehler('einstellung', 'Repo, Zweig oder Token fehlt');
  if (!dateien?.length) throw new AbgleichFehler('einstellung', 'Nichts zu senden');
  let serverzeit = null;

  async function rufe(methode, pfad, body, erlaubt = []) {
    const schreibt = methode !== 'GET';
    if (schreibt) await takt.vorSchreiben();
    if (signal?.aborted) throw new AbgleichFehler('abgebrochen', 'Senden abgebrochen');
    let res;
    try {
      res = await fetch(`${API}/repos/${quelle.repo}${pfad}`, {
        method: methode, signal, cache: 'no-store',
        headers: { Authorization: `Bearer ${quelle.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      if (e?.name === 'AbortError' || signal?.aborted) throw new AbgleichFehler('abgebrochen', 'Senden abgebrochen');
      throw new AbgleichFehler('netz', 'Keine Antwort von GitHub', { ursache: String(e?.message ?? e) });
    } finally {
      if (schreibt) takt.nachSchreiben();
    }
    const datum = res.headers.get('date');
    if (datum && Number.isFinite(Date.parse(datum))) serverzeit = Date.parse(datum);
    if (!res.ok && !erlaubt.includes(res.status)) throw await antwortFehler(res, jetzt);
    if (!res.ok) return { status: res.status, daten: null };
    try { return { status: res.status, daten: await res.json() }; } catch {
      throw new AbgleichFehler('antwort', 'GitHub antwortet nicht mit JSON', { status: res.status });
    }
  }

  const lies = async (was, pfad) => {
    const { daten } = await rufe('GET', pfad);
    return was(daten);
  };
  async function kopf() {
    const sha = await lies((d) => d?.object?.sha, `/git/ref/heads/${zweig}`);
    if (typeof sha !== 'string') throw new AbgleichFehler('antwort', 'GitHub liefert keinen Kopf des Zweigs');
    const baum = await lies((d) => d?.tree?.sha, `/git/commits/${sha}`);
    if (typeof baum !== 'string') throw new AbgleichFehler('antwort', 'GitHub liefert den Baum des Kopfs nicht');
    return { sha, baum };
  }

  bei({ phase: 'kopf', versuch: 1 });
  let k = await kopf();
  bei({ phase: 'blobs', versuch: 1 });
  const eintraege = [];
  for (const d of dateien) {
    const { daten } = await rufe('POST', '/git/blobs', { content: d.inhalt, encoding: 'utf-8' });
    if (typeof daten?.sha !== 'string') throw new AbgleichFehler('antwort', 'GitHub legt den Blob nicht an');
    eintraege.push({ path: d.pfad, mode: '100644', type: 'blob', sha: daten.sha });
  }
  for (let versuch = 1; versuch <= NEUBAU_MAX; versuch++) {
    bei({ phase: 'baum', versuch });
    const baum = (await rufe('POST', '/git/trees', { base_tree: k.baum, tree: eintraege })).daten;
    bei({ phase: 'commit', versuch });
    const commit = (await rufe('POST', '/git/commits', { message: nachricht, tree: baum?.sha, parents: [k.sha] })).daten;
    if (typeof baum?.sha !== 'string' || typeof commit?.sha !== 'string') throw new AbgleichFehler('antwort', 'GitHub legt Baum oder Commit nicht an');
    bei({ phase: 'zweig', versuch });
    const r = await rufe('PATCH', `/git/refs/heads/${zweig}`, { sha: commit.sha, force: false }, [409, 422]);
    if (r.status < 300) return { commit: commit.sha, versuche: versuch, serverzeit };
    // 409 oder 422: der Zweig ist weitergerückt oder die Anfrage ist falsch. Bewegt hat er sich, wenn der Kopf ein anderer ist.
    const neu = await kopf();
    if (neu.sha === k.sha) throw new AbgleichFehler('antwort', `GitHub lehnt das Verschieben des Zweigs ab (Status ${r.status})`, { status: r.status });
    k = neu;
  }
  throw new AbgleichFehler('antwort', 'Der Zweig bewegt sich zu oft; die Sendung bleibt in der Schlange', { status: 409 });
}
