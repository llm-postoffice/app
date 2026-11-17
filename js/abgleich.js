// Abgleich: liest die Einträge aus dem Datenrepo über die GitHub-API in die Datenbank des Geräts. Gewählt nach der
// Probe E6 (Archiv scheitert an CORS, verschachtelte GraphQL-Bäume sind unzuverlässig):
//  1. Baum per REST (git/trees, recursive) mit eigenem If-None-Match und cache 'no-store' (GitHub sendet max-age=60);
//     304 kostet kein Limit. Gefiltert auf projects.md und die Dateien der Eintragsordner unter entries/.
//  2. Fehlende Prüfsummen per GraphQL object(oid:) in Stapeln bis 250 Aliase (485 gingen in einem Aufruf, 2,1 s, 1 Punkt).
//     Der POST bleibt ohne no-store, damit der Preflight im Cache bleibt.
//  3. Rückfall bei Fehlern von GraphQL: REST-Blobs mit vier gleichzeitigen Anfragen.
// Der Abgleich bekommt fetch und die Datenbank als Parameter und läuft so unter node --test gegen eine Mock-Quelle.
// Fortsetzung: Ein neuer Baum steht als 'neu' in der Datenbank, jede geladene Datei ist sofort gespeichert; bricht der
// Abgleich ab, macht der nächste dort weiter. Erst wenn alle Dateien da sind, wird 'neu' zu 'stand', und was der Baum
// nicht mehr nennt, fällt weg. Gelesen wird immer aus 'stand', der Zustand springt also nie halb um.

import { ANHANG_MAX, anhangPfad } from './anhaenge.js';

export const API = 'https://api.github.com';
export const STAPEL = 250;
export const PARALLEL = 4;
const SHA_RE = /^[0-9a-f]{40}$/;
const REPO_RE = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const ZWEIG_RE = /^[A-Za-z0-9_./-]+$/;

/**
 * Ein Fehler des Abgleichs. `art` sagt, was die Anzeige tun soll:
 *   token (401), limit (GitHub bremst; bis = Zeitpunkt in ms oder null), verboten (403 ohne Limit),
 *   nicht-gefunden (404), zu-gross (Baum abgeschnitten), netz (keine Antwort), antwort (anderer Status),
 *   einstellung (Repo oder Zweig ungültig), abgebrochen.
 */
export class AbgleichFehler extends Error {
  constructor(art, meldung, einzelheiten = {}) {
    super(meldung);
    this.name = 'AbgleichFehler';
    this.art = art;
    Object.assign(this, einzelheiten);
  }
}

export async function antwortFehler(res, jetzt) {
  const status = res.status;
  if (status === 401) return new AbgleichFehler('token', 'Token abgelehnt', { status });
  if (status === 403 || status === 429) {
    let nachricht = '';
    try { nachricht = String((await res.json())?.message ?? ''); } catch { /* kein JSON */ }
    const rest = res.headers.get('x-ratelimit-remaining');
    if (status === 429 || rest === '0' || /rate limit/i.test(nachricht)) {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const warte = Number(res.headers.get('retry-after'));   // null wird zu 0 und zählt nicht
      const bis = warte > 0 ? jetzt() + warte * 1000 : reset > 0 ? reset * 1000 : null;
      return new AbgleichFehler('limit', 'GitHub bremst', { status, bis });
    }
    return new AbgleichFehler('verboten', 'Zugriff verweigert', { status });
  }
  if (status === 404) return new AbgleichFehler('nicht-gefunden', 'Repo nicht gefunden', { status });
  return new AbgleichFehler('antwort', `GitHub antwortet mit Status ${status}`, { status });
}

function lesbaresLimit(kopf) {
  const zahl = (n) => { const v = kopf.get(n); return v === null || v === '' ? null : Number(v); };
  const reset = zahl('x-ratelimit-reset');
  return { verbleibend: zahl('x-ratelimit-remaining'), grenze: zahl('x-ratelimit-limit'), zuruecksetzen: reset === null ? null : reset * 1000 };
}

/** Ruft fetch auf und übersetzt Netzfehler und Abbruch in AbgleichFehler; merkt Limit und Serverzeit. */
async function anfrage(ctx, art, url, init) {
  if (ctx.signal?.aborted) throw new AbgleichFehler('abgebrochen', 'Abgleich abgebrochen');
  ctx.anfragen[art]++;
  let res;
  try {
    res = await ctx.fetch(url, { ...init, signal: ctx.signal });
  } catch (e) {
    if (e?.name === 'AbortError' || ctx.signal?.aborted) throw new AbgleichFehler('abgebrochen', 'Abgleich abgebrochen');
    throw new AbgleichFehler('netz', 'Keine Antwort von GitHub', { ursache: String(e?.message ?? e) });
  }
  const limit = lesbaresLimit(res.headers);
  if (limit.verbleibend !== null) ctx.limit = limit;
  const datum = res.headers.get('date');
  if (datum && Number.isFinite(Date.parse(datum))) ctx.serverzeit = Date.parse(datum);
  return res;
}

const kopf = (ctx) => ({ Authorization: `Bearer ${ctx.token}` });

/** Liest den JSON-Körper; eine Antwort, die keiner ist (etwa die Seite eines Proxys), ist ein Fehler der Art antwort. */
async function jsonVon(res) {
  try {
    return await res.json();
  } catch {
    throw new AbgleichFehler('antwort', 'GitHub antwortet nicht mit JSON', { status: res.status });
  }
}

/**
 * Welche Pfade liest die App sofort? projects.md und die Dateien der Eintragsordner (entries/XX/ID/DATEI). Anhänge
 * (entries/XX/ID/attachments/...) bleiben weg: sie sind binär und groß. Der Baum nennt sie mit Name und Größe
 * (baum.anhaenge); ihren Inhalt lädt die App erst, wenn der Nutzer einen Anhang öffnet (holeAnhang).
 */
export const liestApp = (pfad) => pfad === 'projects.md' || (pfad.startsWith('entries/') && pfad.split('/').length <= 4);

async function holeBaum(ctx, etag) {
  const k = kopf(ctx);
  if (etag) k['If-None-Match'] = etag;
  const res = await anfrage(ctx, 'baum', `${API}/repos/${ctx.repo}/git/trees/${ctx.zweig}?recursive=1`, { headers: k, cache: 'no-store' });
  if (res.status === 304) return null;
  if (!res.ok) throw await antwortFehler(res, ctx.jetzt);
  const j = await jsonVon(res);
  if (j.truncated) throw new AbgleichFehler('zu-gross', 'Die Liste der Dateien ist zu groß für eine Anfrage');
  // Eine Antwort ohne Liste darf nie als leeres Repo gelten: der Abschluss räumt, was der Baum nicht nennt, weg.
  if (!Array.isArray(j.tree) || typeof j.sha !== 'string') throw new AbgleichFehler('antwort', 'GitHub liefert keine Dateiliste', { status: res.status });
  const eintraege = j.tree
    .filter((t) => t.type === 'blob' && SHA_RE.test(t.sha) && liestApp(t.path))
    .map((t) => ({ pfad: t.path, sha: t.sha }));
  const anhaenge = [];
  for (const t of j.tree) {
    if (t.type !== 'blob' || !SHA_RE.test(t.sha)) continue;
    const a = anhangPfad(t.path);
    if (a) anhaenge.push({ ...a, sha: t.sha, groesse: Number.isFinite(t.size) ? t.size : 0 });
  }
  return { sha: j.sha, etag: res.headers.get('etag'), eintraege, anhaenge };
}

/** Holt Blobs per GraphQL; liefert Map sha zu Text für alles, was ganz und als Text kam. */
async function graphqlStapel(ctx, shas) {
  const felder = shas.map((s, i) => `a${i}: object(oid: "${s}") { ... on Blob { text isTruncated isBinary } }`).join(' ');
  const query = `query($o: String!, $n: String!) { repository(owner: $o, name: $n) { ${felder} } }`;
  const res = await anfrage(ctx, 'graphql', `${API}/graphql`, {
    method: 'POST', headers: { ...kopf(ctx), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { o: ctx.eigentuemer, n: ctx.name } }),
  });
  if (!res.ok) throw await antwortFehler(res, ctx.jetzt);
  const j = await jsonVon(res);
  const fehler = j.errors ?? [];
  if (fehler.some((e) => e.type === 'RATE_LIMITED')) throw new AbgleichFehler('limit', 'GitHub bremst', { status: 200, bis: ctx.limit?.zuruecksetzen ?? null });
  const repo = j.data?.repository;
  if (!repo) throw new AbgleichFehler('antwort', `GraphQL: ${fehler[0]?.message ?? 'keine Daten'}`);
  const texte = new Map();
  shas.forEach((sha, i) => {
    const o = repo[`a${i}`];
    if (o && typeof o.text === 'string' && !o.isTruncated && !o.isBinary) texte.set(sha, o.text);
  });
  return texte;
}

function dekodiere(blob) {
  if (blob.encoding === 'base64') return new TextDecoder().decode(Uint8Array.from(atob(blob.content), (c) => c.charCodeAt(0)));
  if (blob.encoding === 'utf-8') return String(blob.content);
  throw new AbgleichFehler('antwort', `Blob mit unbekannter Kodierung ${blob.encoding}`);
}

async function restBlob(ctx, sha) {
  const res = await anfrage(ctx, 'rest', `${API}/repos/${ctx.repo}/git/blobs/${sha}`, { headers: kopf(ctx) });
  if (!res.ok) throw await antwortFehler(res, ctx.jetzt);
  return dekodiere(await jsonVon(res));
}

/** Arbeitet `liste` mit höchstens n gleichzeitigen Aufrufen ab; nach dem ersten Fehler beginnt keiner mehr. */
async function nebenher(liste, n, arbeit) {
  let i = 0;
  let gestoppt = false;
  const lauf = async () => {
    while (!gestoppt && i < liste.length) {
      const x = liste[i++];
      try { await arbeit(x); } catch (e) { gestoppt = true; throw e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, lauf));
}

const ENDGUELTIG = new Set(['token', 'limit', 'verboten', 'nicht-gefunden', 'abgebrochen', 'einstellung']);

/**
 * Gleicht ab. Parameter:
 *   fetch   wie window.fetch
 *   db      Datenbank (speicher.js)
 *   quelle  { repo: 'EIGENTÜMER/NAME', token, zweig: 'main' }
 *   jetzt   Uhr in ms; bei(zustand) meldet { phase: 'baum' | 'dateien' | 'fertig', fertig, gesamt }
 *   signal  AbortSignal; stapel und parallel ändern die Größen (für Tests)
 * Ergebnis: { art: 'unveraendert' | 'aktualisiert', dateien, neu, anfragen: { baum, graphql, rest }, limit, serverzeit }.
 * Fehler: AbgleichFehler.
 */
export async function abgleichen({ fetch, db, quelle, jetzt = () => Date.now(), bei = () => {}, signal, stapel = STAPEL, parallel = PARALLEL }) {
  const m = REPO_RE.exec(quelle?.repo ?? '');
  const zweig = quelle?.zweig ?? 'main';
  if (!m || !ZWEIG_RE.test(zweig) || !quelle.token) throw new AbgleichFehler('einstellung', 'Repo, Zweig oder Token fehlt');
  const ctx = {
    fetch, signal, jetzt, repo: quelle.repo, eigentuemer: m[1], name: m[2], zweig, token: quelle.token,
    anfragen: { baum: 0, graphql: 0, rest: 0 }, limit: null, serverzeit: null,
  };
  bei({ phase: 'baum' });
  const stand = await db.lies('baum', 'stand');
  const neu = await db.lies('baum', 'neu');
  // Ein Stand aus einer Fassung ohne Anhänge hat keine Liste davon: ohne ETag kommt der Baum noch einmal ganz
  const vorher = neu ?? stand;
  const baum = await holeBaum(ctx, Array.isArray(vorher?.anhaenge) ? vorher.etag ?? null : null);
  let ziel = neu ?? stand;
  if (baum) {
    if (stand && stand.sha === baum.sha) {
      // Derselbe Inhalt unter neuer Kennung (etwa nach einem Revert): nichts zu laden, nur die Kennung merken.
      ziel = { ...stand, etag: baum.etag, anhaenge: baum.anhaenge };
      await db.aendere([{ speicher: 'baum', setze: ziel }, { speicher: 'baum', entferne: 'neu' }]);
    } else {
      ziel = { name: 'neu', sha: baum.sha, etag: baum.etag, eintraege: baum.eintraege, anhaenge: baum.anhaenge, vollstaendig: false, zeit: jetzt(), geprueft: null };
      await db.schreibe('baum', ziel);
    }
  }
  if (!ziel) throw new AbgleichFehler('antwort', 'GitHub antwortet ohne Dateiliste');

  const vorhanden = new Set(await db.schluessel('dateien'));
  const gesamt = ziel.eintraege.length;
  const proSha = new Map();
  for (const e of ziel.eintraege) proSha.set(e.sha, (proSha.get(e.sha) ?? 0) + 1);
  const fehlend = [...proSha.keys()].filter((sha) => !vorhanden.has(sha));
  let fertig = gesamt - fehlend.reduce((n, sha) => n + proSha.get(sha), 0);
  bei({ phase: 'dateien', fertig, gesamt });

  const speichern = async (texte) => {
    await db.aendere([...texte].map(([sha, text]) => ({ speicher: 'dateien', setze: { sha, text } })));
    for (const sha of texte.keys()) fertig += proSha.get(sha);
    bei({ phase: 'dateien', fertig, gesamt });
  };
  let graphqlGeht = true;
  for (let von = 0; von < fehlend.length; von += stapel) {
    if (signal?.aborted) throw new AbgleichFehler('abgebrochen', 'Abgleich abgebrochen');
    const teil = fehlend.slice(von, von + stapel);
    let rest = teil;
    if (graphqlGeht) {
      try {
        const texte = await graphqlStapel(ctx, teil);
        await speichern(texte);
        rest = teil.filter((sha) => !texte.has(sha));
      } catch (e) {
        if (ENDGUELTIG.has(e.art)) throw e;
        graphqlGeht = false;   // ein Fehler von GraphQL (502, Netz): der Rest dieses Abgleichs geht per REST
      }
    }
    await nebenher(rest, parallel, async (sha) => speichern(new Map([[sha, await restBlob(ctx, sha)]])));
  }

  const alle = new Set(await db.schluessel('dateien'));
  if (ziel.eintraege.some((e) => !alle.has(e.sha))) throw new AbgleichFehler('antwort', 'Nicht alle Dateien sind angekommen');
  const art = ziel.name === 'stand' && !fehlend.length ? 'unveraendert' : 'aktualisiert';
  const jetztMs = jetzt();
  const gebraucht = new Set(proSha.keys());
  const anhangShas = new Set((ziel.anhaenge ?? []).map((a) => a.sha));
  const fertigerStand = { ...ziel, name: 'stand', vollstaendig: true, zeit: ziel.name === 'stand' ? ziel.zeit : jetztMs, geprueft: jetztMs };
  await db.aendere([
    { speicher: 'baum', setze: fertigerStand },
    { speicher: 'baum', entferne: 'neu' },
    ...[...alle].filter((sha) => !gebraucht.has(sha)).map((sha) => ({ speicher: 'dateien', entferne: sha })),
    // Geladene Anhänge, die der Baum nicht mehr nennt, fallen weg
    ...(await db.schluessel('anhaenge')).filter((sha) => !anhangShas.has(sha)).map((sha) => ({ speicher: 'anhaenge', entferne: sha })),
  ]);
  bei({ phase: 'fertig', fertig: gesamt, gesamt });
  return { art, dateien: gesamt, neu: fehlend.length, anfragen: ctx.anfragen, limit: ctx.limit, serverzeit: ctx.serverzeit };
}

/** Liest den vollständig geladenen Stand aus der Datenbank: Map Pfad zu Text, dazu den Baum; null, wenn es keinen gibt. */
export async function leseStand(db) {
  const baum = await db.lies('baum', 'stand');
  if (!baum) return null;
  const nachSha = new Map((await db.alle('dateien')).map((d) => [d.sha, d.text]));
  const pfade = new Map();
  for (const e of baum.eintraege) if (nachSha.has(e.sha)) pfade.set(e.pfad, nachSha.get(e.sha));
  return { pfade, baum };
}

/**
 * Lädt den Inhalt eines Anhangs über die Blob-Abfrage (Base64, GitHub setzt Zeilenumbrüche hinein) und gibt ihn als Base64
 * ohne Umbrüche zurück. Fehler: AbgleichFehler (netz, token, limit, verboten, nicht-gefunden, antwort) und `zu-gross` für
 * eine Datei über 1 MiB. Die Abfrage geht an api.github.com, das die CSP schon erlaubt.
 */
export async function holeAnhang({ fetch, quelle, sha, jetzt = () => Date.now(), signal }) {
  const m = REPO_RE.exec(quelle?.repo ?? '');
  if (!m || !SHA_RE.test(sha ?? '') || !quelle.token) throw new AbgleichFehler('einstellung', 'Repo, Token oder Anhang fehlt');
  const ctx = { fetch, signal, jetzt, repo: quelle.repo, token: quelle.token, anfragen: { anhang: 0 }, limit: null, serverzeit: null };
  const res = await anfrage(ctx, 'anhang', `${API}/repos/${ctx.repo}/git/blobs/${sha}`, { headers: kopf(ctx) });
  if (!res.ok) throw await antwortFehler(res, jetzt);
  const blob = await jsonVon(res);
  if (blob.encoding !== 'base64' || typeof blob.content !== 'string') throw new AbgleichFehler('antwort', `Blob mit unbekannter Kodierung ${blob.encoding}`);
  if (Number(blob.size) > ANHANG_MAX) throw new AbgleichFehler('zu-gross', 'Der Anhang ist größer als 1 MiB');
  return blob.content.replace(/\s+/g, '');
}
