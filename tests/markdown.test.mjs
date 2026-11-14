// Markdown ohne HTML (Annahme 2) und der Filter für Links (USI-1): der Baum kennt nur Text, Code, fett, kursiv und https-Links.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inline, markdown, markdownBaum, sichererLink } from '../js/markdown.js';

// Eine Attrappe für el(): sie schreibt die Knoten als Text, Attribute in Reihenfolge. Text wird maskiert; so sieht ein Test,
// ob je ein Element aus fremdem Text entstanden ist.
const maske = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const bauen = (tag, attr = {}, ...kinder) => {
  const a = Object.entries(attr).map(([k, v]) => ` ${k}="${v}"`).join('');
  return { s: `<${tag}${a}>${kinder.flat().map((k) => (typeof k === 'string' ? maske(k) : k.s)).join('')}</${tag}>` };
};
const html = (text) => markdown(text, bauen).map((k) => k.s).join('');

test('rohes HTML bleibt Text: kein Element entsteht aus fremdem Text', () => {
  assert.equal(html('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(html('<img src=x onerror=alert(1)>'), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  assert.equal(html('<a href="https://localhost/">x</a>'), '<p>&lt;a href="https://localhost/"&gt;x&lt;/a&gt;</p>');
  assert.equal(html('<b>fett?</b>'), '<p>&lt;b&gt;fett?&lt;/b&gt;</p>');
  assert.equal(html('&lt;b&gt; &amp;'), '<p>&amp;lt;b&amp;gt; &amp;amp;</p>', 'Entitäten bleiben, wie sie stehen');
});

test('Links gibt es allein mit https: und tragen rel="noopener noreferrer"', () => {
  assert.equal(html('[Doku](https://localhost/a?b=1)'),
    '<p><a href="https://localhost/a?b=1" rel="noopener noreferrer" target="_blank" referrerpolicy="no-referrer">Doku</a></p>');
  for (const ziel of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'http://localhost/', 'ftp://localhost/', 'file:///etc/passwd',
    '//localhost/', 'mailto:a@localhost', 'vbscript:x', 'https://localhost:geheim@localhost/', '/relativ', '#anker']) {
    const h = html(`[Text](${ziel})`);
    assert.doesNotMatch(h, /<a /, `${ziel} wurde ein Link`);
    assert.ok(h.startsWith('<p>Text'), `${ziel}: der Text bleibt`);
  }
});

test('ein unsicheres Ziel bleibt als Text sichtbar, damit nichts verschwindet', () => {
  assert.equal(html('[Text](http://localhost/x)'), '<p>Text (http://localhost/x)</p>');
});

test('Adressen im Text werden Links, Satzzeichen am Ende nicht', () => {
  assert.match(html('Siehe https://localhost/pfad.'), /<a href="https:\/\/localhost\/pfad" [^>]*>https:\/\/localhost\/pfad<\/a>\.<\/p>/);
  assert.match(html('<https://localhost/x>'), /<a href="https:\/\/localhost\/x"/);
  assert.doesNotMatch(html('http://localhost/x oder javascript:alert(1)'), /<a /);
  assert.doesNotMatch(html('xhttps://localhost/'), /<a /, 'mitten im Wort kein Link');
});

test('Bilder laden nie: vom Bild bleibt der Alternativtext', () => {
  assert.equal(html('![Bild](https://localhost/a.png)'), '<p>Bild</p>');
  assert.doesNotMatch(html('![x](https://localhost/a.png)'), /<img|src=/);
});

test('fett, kursiv, Code und Escapes', () => {
  assert.equal(html('a **fett** und *schräg* und `code`'), '<p>a <strong>fett</strong> und <em>schräg</em> und <code>code</code></p>');
  assert.equal(html('__fett__ und _schräg_'), '<p><strong>fett</strong> und <em>schräg</em></p>');
  assert.equal(html('snake_case_name bleibt'), '<p>snake_case_name bleibt</p>');
  assert.equal(html('2 * 3 * 4'), '<p>2 * 3 * 4</p>');
  assert.equal(html('\\*kein Stern\\*'), '<p>*kein Stern*</p>');
  assert.equal(html('`<b>x</b>` im Code'), '<p><code>&lt;b&gt;x&lt;/b&gt;</code> im Code</p>');
  assert.equal(html('offen `ungeschlossen'), '<p>offen `ungeschlossen</p>');
});

test('Überschriften, Listen, Zitate, Codeblöcke und Trennlinien', () => {
  assert.equal(html('# Titel\n\ntext'), '<h3>Titel</h3><p>text</p>');
  assert.equal(html('#### vier'), '<h4>vier</h4>');
  assert.equal(html('#kein Leerzeichen'), '<p>#kein Leerzeichen</p>');
  assert.equal(html('- a\n- b'), '<ul><li><p>a</p></li><li><p>b</p></li></ul>');
  assert.equal(html('1. a\n2. b'), '<ol><li><p>a</p></li><li><p>b</p></li></ol>');
  assert.equal(html('- a\n  - b\n- c'), '<ul><li><p>a</p><ul><li><p>b</p></li></ul></li><li><p>c</p></li></ul>');
  assert.equal(html('> zitat\n> zwei'), '<blockquote class="zitat"><p>zitat<br></br>zwei</p></blockquote>');
  assert.equal(html('```text\n<b>x</b> **y**\n```'), '<pre class="text-code"><code>&lt;b&gt;x&lt;/b&gt; **y**</code></pre>');
  assert.equal(html('a\n\n---\n\nb'), '<p>a</p><hr></hr><p>b</p>');
});

test('Zeilenumbrüche im Absatz bleiben Umbrüche', () => {
  assert.equal(html('Befehl in fish:\nsudo install'), '<p>Befehl in fish:<br></br>sudo install</p>');
});

test('eine Tabelle erscheint als Text in festen Zeichen und bricht nicht aus', () => {
  assert.equal(html('| a | b |\n|---|---|\n| 1 | 2 |'), '<pre class="text-code"><code>| a | b |\n|---|---|\n| 1 | 2 |</code></pre>');
});

test('Eingaben ohne Sinn werfen nichts: leer, nur Zeichen, sehr tief verschachtelt', () => {
  assert.deepEqual(markdownBaum(''), []);
  assert.deepEqual(markdownBaum(null), []);
  for (const s of ['*', '**', '[', '](', '![', '`', '```', '> > > > > > > > > > x', '- - - - - - - - - - x', '[a](', '[a]()', '****', '___', '\\']) {
    assert.doesNotThrow(() => html(s), s);
  }
  assert.doesNotThrow(() => html(`${'> '.repeat(500)}x`));
  assert.doesNotThrow(() => html(`${'- '.repeat(500)}x`));
});

test('sichererLink prüft Schema, Rechnername und Zugangsdaten', () => {
  assert.equal(sichererLink('https://localhost/a b'), 'https://localhost/a%20b');
  assert.equal(sichererLink(' https://localhost '), 'https://localhost/');
  assert.equal(sichererLink('http://localhost'), null);
  assert.equal(sichererLink('javascript:alert(1)'), null);
  assert.equal(sichererLink('https://localhost@localhost'), null);
  assert.equal(sichererLink(''), null);
  assert.equal(sichererLink('nicht-url'), null);
});

test('inline gibt Knoten und Text zurück, nie Markup', () => {
  assert.deepEqual(inline('a <b>'), ['a <b>']);
});
