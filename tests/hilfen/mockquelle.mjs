// Eine Mock-Quelle für den Abgleich: ein fetch, das die Endpunkte von GitHub nachbildet, die der Abgleich braucht
// (Baum, GraphQL object(oid:), Blob). Dateien sind ein Map von Pfad zu Text; die Prüfsummen sind echte Git-Blob-
// Prüfsummen. Ein Test kann Ausfälle einschleusen (vorher) und liest das Protokoll der Anfragen. Die Datei läuft in Node
// und im Browser (die Vorschau und der Wegetest nutzen sie dort): sie braucht kein node:-Modul, nur SHA-1 und Base64
// aus eigenem Code.
const kodiere = (text) => new TextEncoder().encode(text);
const byteLaenge = (text) => kodiere(text).length;

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

export const blobSha = (text) => {
  const kopf = kodiere(`blob ${byteLaenge(text)}\0`);
  const koerper = kodiere(text);
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
 */
export function mockQuelle({ dateien, repo = 'org/daten', token = 'TESTTOKEN', vorher, verzoegerung = 0, amNetz = () => true }) {
  const protokoll = [];
  const zaehler = { baum: 0, graphql: 0, blob: 0 };
  let gleichzeitig = 0;
  const q = { dateien, protokoll, zaehler, verzoegerung, hoechstensGleichzeitig: 0, limit: { verbleibend: 4990, reset: 1900000000 } };

  const kopfLimit = () => ({
    'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': String(q.limit.verbleibend), 'x-ratelimit-reset': String(q.limit.reset),
    date: new Date(1700000000000).toUTCString(),
  });

  function baum() {
    const eintraege = [...dateien].map(([path, text]) => ({ path, mode: '100644', type: 'blob', sha: blobSha(text), size: byteLaenge(text) }));
    const ordner = new Set();
    for (const [path] of dateien) for (let i = path.indexOf('/'); i > 0; i = path.indexOf('/', i + 1)) ordner.add(path.slice(0, i));
    const baeume = [...ordner].map((path) => ({ path, mode: '040000', type: 'tree', sha: blobSha(`ordner ${path}`) }));
    const alle = [...baeume, ...eintraege].sort((a, b) => (a.path < b.path ? -1 : 1));
    const sha = sha1Hex(kodiere(alle.map((e) => `${e.path}:${e.sha}`).join('\n')));
    return { sha, tree: alle, truncated: false };
  }

  async function bearbeite(url, init = {}) {
    const u = new URL(url);
    const k = new Headers(init.headers);
    const art = u.pathname === '/graphql' ? 'graphql' : u.pathname.includes('/git/trees/') ? 'baum' : u.pathname.includes('/git/blobs/') ? 'blob' : 'sonst';
    zaehler[art] = (zaehler[art] ?? 0) + 1;
    const eintrag = { art, n: zaehler[art], url: u.href, methode: init.method ?? 'GET', cache: init.cache, kopf: k, body: init.body };
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
      return json({ sha, size: byteLaenge(treffer), encoding: 'base64', content: base64(kodiere(treffer)).replace(/(.{60})/g, '$1\n') }, 200, kopfLimit());
    }
    if (art === 'graphql') {
      const { query, variables } = JSON.parse(init.body);
      if (`${variables.o}/${variables.n}` !== repo) return json({ data: { repository: null }, errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a Repository' }] }, 200, kopfLimit());
      const repository = {};
      for (const m of query.matchAll(/(a\d+): object\(oid: "([0-9a-f]{40})"\)/g)) {
        const text = [...dateien.values()].find((t) => blobSha(t) === m[2]);
        repository[m[1]] = text === undefined ? null : { text, isTruncated: false, isBinary: false };
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
