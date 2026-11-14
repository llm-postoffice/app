import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ERLAUBT_APP, ERLAUBT_WERKZEUG, hostsIn } from '../tools/fremdhost.mjs';

// Fremde Adressen entstehen erst zur Laufzeit, damit der Test selbst keinen Fremdhost nennt.
const fremd = (host) => `https:${'//'}${host}`;

test('hostsIn findet Hosts in Adressen, mit Port und Pfad, und die Zeile', () => {
  const f = hostsIn(`ok\nconnect ${fremd('API.Example.org')}:8443/pfad?x=1\n`);
  assert.deepEqual(f, [{ host: 'api.example.org', zeile: 2 }]);
});

test('hostsIn findet protokollrelative Adressen in HTML und CSS', () => {
  const f = hostsIn(`<script src="${'//'}cdn.example.org/a.js"></script>\na { background: url(${'//'}img.example.org/b.png) }`);
  assert.deepEqual(f.map((x) => x.host), ['cdn.example.org', 'img.example.org']);
});

test('hostsIn übersieht relative Adressen, Fragmente und Kommentare mit Doppelstrich', () => {
  assert.deepEqual(hostsIn('<a href="#wartet"></a> <script src="js/start.js"></script> // Kommentar mit a/b'), []);
});

test('die App darf nur api.github.com und ntfy.sh nennen, die Werkzeuge zusätzlich den eigenen Rechner', () => {
  assert.deepEqual(ERLAUBT_APP, ['api.github.com', 'ntfy.sh']);
  assert.deepEqual(ERLAUBT_WERKZEUG, [...ERLAUBT_APP, '127.0.0.1', 'localhost']);
});
