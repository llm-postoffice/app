// Eine Mock-Quelle für Abgleich und Senden: ein fetch, das die Endpunkte von GitHub nachbildet, die die App braucht.
// Lesen: Baum, GraphQL object(oid:), Blob. Schreiben (Teil E, Git Data API): Kopf des Zweigs, Commit lesen, Blob, Baum mit
// base_tree, Commit und das Verschieben des Zweigs (ohne force nur vorwärts, sonst 422 wie GitHub). Dateien sind ein Map
// von Pfad zu Text (Anhänge auch zu Bytes); ein angenommener Commit ersetzt den Inhalt des Map, ein Test, der das Map selbst ändert, spielt
// einen fremden Push (der Kopf rückt dann von allein weiter). Die Prüfsummen sind echte Git-Blob-Prüfsummen. Ein Test kann Ausfälle einschleusen (vorher) und liest das Protokoll der Anfragen. Die Datei läuft in Node
// und im Browser (die Vorschau und der Wegetest nutzen sie dort): sie braucht kein node:-Modul, nur SHA-1 und Base64
// aus eigenem Code.
const kodiere = (text) => new TextEncoder().encode(text);
// Der Inhalt einer Datei ist Text (String) oder, für Anhänge, Bytes (Uint8Array)
const bytesVon = (inhalt) => (typeof inhalt === 'string' ? kodiere(inhalt) : inhalt);
const byteLaenge = (inhalt) => bytesVon(inhalt).length;
const ausBase64 = (b64) => Uint8Array.from(atob(b64.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
/** Bytes, die gültiges UTF-8 sind, bleiben Text (damit Tests Strings vergleichen können); sonst bleiben es Bytes. */
const textOderBytes = (bytes) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return bytes; } };

/** SHA-1 über Bytes, Ergebnis als Hex; gerade genug, um Git-Prüfsummen zu bilden. */
export function sha1Hex(bytes) {
  const l = bytes.length;
  const n = ((l + 8) >> 6) + 1;
  const w = new Uint32Array(n * 16);
  for (let i = 0; i < l; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  w[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
  w[n * 16 - 1] = l * 8;
  const rol = (x, s) => (x << s) | (x >>> (32 - s));
  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const x = new Uint32Array(80);
  for (let b = 0; b < n; b++) {
    for (let i = 0; i < 16; i++) x[i] = w[b * 16 + i];
    for (let i = 16; i < 80; i++) x[i] = rol(x[i - 3] ^ x[i - 8] ^ x[i - 14] ^ x[i - 16], 1);
    let [a, bb, c, d, e] = [h0, h1, h2, h3, h4];
    for (let i = 0; i < 80; i++) {
      const [f, kk] = i < 20 ? [(bb & c) | (~bb & d), 0x5a827999] : i < 40 ? [bb ^ c ^ d, 0x6ed9eba1]
        : i < 60 ? [(bb & c) | (bb & d) | (c & d), 0x8f1bbcdc] : [bb ^ c ^ d, 0xca62c1d6];
      const tmp = (rol(a, 5) + f + e + kk + x[i]) >>> 0;
      [e, d, c, bb, a] = [d, c, rol(bb, 30) >>> 0, a, tmp];
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((v) => v.toString(16).padStart(8, '0')).join('');
}

const base64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};

export const blobSha = (inhalt) => {
  const koerper = bytesVon(inhalt);
  const kopf = kodiere(`blob ${koerper.length}\0`);
  const alles = new Uint8Array(kopf.length + koerper.length);
  alles.set(kopf); alles.set(koerper, kopf.length);
  return sha1Hex(alles);
};

const json = (obj, status = 200, kopf = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...kopf } });

/**
 * @param {object} o
 * @param {Map<string,string>} o.dateien   Pfad zu Text; ein Test darf das Map zwischen den Abgleichen ändern
 * @param {string} [o.repo]                'EIGENTÜMER/NAME'
 * @param {string} [o.token]               nur dieses Token wird angenommen
 * @param {(anfrage:object)=>(Response|undefined)} [o.vorher]  darf eine Antwort vorgeben oder werfen
 * @param {number} [o.verzoegerung]        Wartezeit je Anfrage in ms (für Prüfungen der Gleichzeitigkeit)
 * @param {()=>boolean} [o.amNetz]         sagt false, dann scheitert jede Anfrage wie ohne Netz (TypeError, wie fetch)
 * @param {()=>number} [o.serverzeit]      Uhr des Servers für den Date-Kopf (ms)
 * @param {boolean} [o.darfSchreiben]      false: schreibende Anfragen antworten 403 wie bei einem Token ohne Schreibrecht
 * @param {(c:object)=>void} [o.beiCommit] wird gerufen, sobald ein Commit den Zweig verschoben hat ({ sha, message, dateien })
 * @param {string} [o.zweig]               Name des Zweigs
 */
export function mockQuelle({ dateien, repo = 'org/daten', token = 'TESTTOKEN', vorher, verzoegerung = 0, amNetz = () => true, serverzeit = () => 1700000000000, darfSchreiben = true, beiCommit = null, zweig = 'main' }) {
  const protokoll = [];
  const zaehler = { baum: 0, graphql: 0, blob: 0 };
  let gleichzeitig = 0;
  const q = { dateien, protokoll, zaehler, verzoegerung, hoechstensGleichzeitig: 0, limit: { verbleibend: 4990, reset: 1900000000 }, commits: [], blobs: new Map(), baeume: new Map(), objekte: new Map() };

  const kopfLimit = () => ({
    'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': String(q.limit.verbleibend), 'x-ratelimit-reset': String(q.limit.reset),
    date: new Date(serverzeit()).toUTCString(),
  });

  function baumVon(dateien) {
    const eintraege = [...dateien].map(([path, text]) => ({ path, mode: '100644', type: 'blob', sha: blobSha(text), size: byteLaenge(text) }));
    const ordner = new Set();
    for (const [path] of dateien) for (let i = path.indexOf('/'); i > 0; i = path.indexOf('/', i + 1)) ordner.add(path.slice(0, i));
    const baeume = [...ordner].map((path) => ({ path, mode: '040000', type: 'tree', sha: blobSha(`ordner ${path}`) }));
    const alle = [...baeume, ...eintraege].sort((a, b) => (a.path < b.path ? -1 : 1));
    const sha = sha1Hex(kodiere(alle.map((e) => `${e.path}:${e.sha}`).join('\n')));
    return { sha, tree: alle, truncated: false };
  }
  const baum = () => baumVon(dateien);

  // Der Kopf des Zweigs. Ändert ein Test das Map `dateien` selbst, gilt das als fremder Push: es entsteht ein Commit darauf.
  let kopf = null;
  function aktuellerKopf() {
    const b = baumVon(dateien).sha;
    if (!kopf || kopf.baum !== b) {
      const sha = sha1Hex(kodiere(`commit ${b} ${kopf?.sha ?? 'wurzel'} ${q.commits.length}`));
      const fremd = Boolean(kopf);
      kopf = { sha, baum: b, eltern: kopf ? [kopf.sha] : [], message: fremd ? 'fremder Push' : 'Ausgangslage', dateien: new Map(dateien) };
      q.objekte.set(sha, kopf);
      q.baeume.set(b, new Map(dateien));
      if (fremd) q.commits.push({ sha, message: kopf.message, fremd: true });
    }
    return kopf;
  }

  /** Schreibende Endpunkte der Git Data API; gibt eine Antwort oder undefined zurück (dann ist der Pfad unbekannt). */
  function schreibe(art, init, prefix) {
    const body = init.body ? JSON.parse(init.body) : {};
    const lim = kopfLimit();
    if (art === 'blobNeu') {
      const kodierung = body.encoding ?? 'utf-8';
      if (typeof body.content !== 'string' || !['utf-8', 'base64'].includes(kodierung)) return json({ message: 'Invalid blob' }, 422, lim);
      let inhalt = body.content;
      if (kodierung === 'base64') {
        try { inhalt = textOderBytes(ausBase64(body.content)); } catch { return json({ message: 'Invalid blob' }, 422, lim); }
      }
      const sha = blobSha(inhalt);
      q.blobs.set(sha, inhalt);
      return json({ sha, url: `https://api.github.com${prefix}/git/blobs/${sha}` }, 201, lim);
    }
    if (art === 'baumNeu') {
      const basis = q.baeume.get(body.base_tree);
      if (!basis) return json({ message: 'The tree base_tree does not exist' }, 422, lim);
      const neu = new Map(basis);
      for (const t of body.tree ?? []) {
        if (t.type !== 'blob' || t.mode !== '100644' || !q.blobs.has(t.sha) || typeof t.path !== 'string' || t.path.startsWith('/') || t.path.includes('..')) return json({ message: 'Invalid tree entry' }, 422, lim);
        neu.set(t.path, q.blobs.get(t.sha));
      }
      const sha = baumVon(neu).sha;
      q.baeume.set(sha, neu);
      return json({ sha, tree: [] }, 201, lim);
    }
    if (art === 'commitNeu') {
      const baum = q.baeume.get(body.tree);
      if (!baum || !Array.isArray(body.parents) || body.parents.some((p) => !q.objekte.has(p))) return json({ message: 'Invalid commit' }, 422, lim);
      const sha = sha1Hex(kodiere(`commit ${body.tree} ${body.parents.join(',')} ${body.message} ${q.objekte.size}`));
      q.objekte.set(sha, { sha, baum: body.tree, eltern: body.parents, message: String(body.message), dateien: baum });
      return json({ sha, tree: { sha: body.tree }, parents: body.parents.map((p) => ({ sha: p })), message: body.message }, 201, lim);
    }
    if (art === 'refNeu') {
      const c = q.objekte.get(body.sha);
      if (!c) return json({ message: 'Object does not exist' }, 422, lim);
      const jetzt = aktuellerKopf();
      if (!body.force && body.sha !== jetzt.sha && !c.eltern.includes(jetzt.sha)) return json({ message: 'Update is not a fast forward' }, 422, lim);
      kopf = c;
      dateien.clear();
      for (const [p, t] of c.dateien) dateien.set(p, t);
      q.commits.push({ sha: c.sha, message: c.message, eltern: c.eltern, dateien: new Map(c.dateien) });
      beiCommit?.(q.commits.at(-1));
      return json({ ref: `refs/heads/${zweig}`, object: { sha: c.sha, type: 'commit' } }, 200, lim);
    }
    return undefined;
  }

  async function bearbeite(url, init = {}) {
    const u = new URL(url);
    const k = new Headers(init.headers);
    const methode = (init.method ?? 'GET').toUpperCase();
    const git = u.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/git\//, '');
    const art = u.pathname === '/graphql' ? 'graphql' : u.pathname.includes('/git/trees/') ? 'baum' : u.pathname.includes('/git/blobs/') ? 'blob'
      : methode === 'POST' && git === 'blobs' ? 'blobNeu' : methode === 'POST' && git === 'trees' ? 'baumNeu' : methode === 'POST' && git === 'commits' ? 'commitNeu'
        : methode === 'PATCH' && git === `refs/heads/${zweig}` ? 'refNeu' : methode === 'GET' && git === `ref/heads/${zweig}` ? 'ref' : methode === 'GET' && /^commits\/[0-9a-f]{40}$/.test(git) ? 'commit' : 'sonst';
    zaehler[art] = (zaehler[art] ?? 0) + 1;
    const eintrag = { art, n: zaehler[art], url: u.href, methode, cache: init.cache, kopf: k, body: init.body };
    protokoll.push(eintrag);
    const vor = vorher?.(eintrag);
    if (vor) return vor;
    if (k.get('authorization') !== `Bearer ${token}`) return json({ message: 'Bad credentials' }, 401);
    const prefix = `/repos/${repo}`;
    if (art === 'baum' && u.pathname.startsWith(prefix)) {
      const b = baum();
      const etag = `"${b.sha}"`;
      // wie GitHub: die Antwort trägt ein schwaches ETag, verglichen wird schwach, der 304 trägt es ohne W/
      if ((k.get('if-none-match') ?? '').replace(/^W\//, '') === etag) return new Response(null, { status: 304, headers: { etag, ...kopfLimit() } });
      return json(b, 200, { etag: `W/${etag}`, ...kopfLimit() });
    }
    if (art === 'blob' && u.pathname.startsWith(prefix)) {
      const sha = u.pathname.split('/').pop();
      const treffer = [...dateien.values()].find((t) => blobSha(t) === sha);
      if (treffer === undefined) return json({ message: 'Not Found' }, 404, kopfLimit());
      return json({ sha, size: byteLaenge(treffer), encoding: 'base64', content: base64(bytesVon(treffer)).replace(/(.{60})/g, '$1\n') }, 200, kopfLimit());
    }
    if (art === 'ref') return json({ ref: `refs/heads/${zweig}`, object: { sha: aktuellerKopf().sha, type: 'commit' } }, 200, kopfLimit());
    if (art === 'commit') {
      const c = q.objekte.get(git.slice(8)) ?? (git.slice(8) === aktuellerKopf().sha ? kopf : null);
      return c ? json({ sha: c.sha, tree: { sha: c.baum }, parents: c.eltern.map((p) => ({ sha: p })), message: c.message }, 200, kopfLimit()) : json({ message: 'Not Found' }, 404, kopfLimit());
    }
    if (['blobNeu', 'baumNeu', 'commitNeu', 'refNeu'].includes(art) && u.pathname.startsWith(prefix)) {
      if (!darfSchreiben) return json({ message: 'Resource not accessible by personal access token' }, 403, kopfLimit());
      aktuellerKopf();
      return schreibe(art, init, prefix) ?? json({ message: 'Not Found' }, 404);
    }
    if (art === 'graphql') {
      const { query, variables } = JSON.parse(init.body);
      if (`${variables.o}/${variables.n}` !== repo) return json({ data: { repository: null }, errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a Repository' }] }, 200, kopfLimit());
      const repository = {};
      for (const m of query.matchAll(/(a\d+): object\(oid: "([0-9a-f]{40})"\)/g)) {
        const text = [...dateien.values()].find((t) => blobSha(t) === m[2]);
        repository[m[1]] = text === undefined ? null : typeof text === 'string' ? { text, isTruncated: false, isBinary: false } : { text: null, isTruncated: false, isBinary: true };
      }
      return json({ data: { repository } }, 200, kopfLimit());
    }
    return json({ message: 'Not Found' }, 404);
  }

  q.fetch = async (url, init) => {
    if (!amNetz()) throw new TypeError('Failed to fetch');
    gleichzeitig++;
    q.hoechstensGleichzeitig = Math.max(q.hoechstensGleichzeitig, gleichzeitig);
    try {
      if (q.verzoegerung) await new Promise((r) => setTimeout(r, q.verzoegerung));   // ein Test darf sie ändern
      if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      return await bearbeite(url, init);
    } finally {
      gleichzeitig--;
    }
  };
  /** Aliase, die die GraphQL-Anfragen verlangt haben, je Anfrage. */
  q.graphqlGroessen = () => protokoll.filter((p) => p.art === 'graphql').map((p) => (p.body.match(/ object\(oid:/g) ?? []).length);
  return q;
}

/** Eine Antwort mit Status und Kopfzeilen, für Ausfälle. */
export const antwort = (status, kopf = {}, obj = { message: 'x' }) => json(obj, status, kopf);
