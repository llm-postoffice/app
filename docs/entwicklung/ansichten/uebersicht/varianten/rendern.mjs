#!/usr/bin/env node
// Rendert die Entwurfsseiten mit dem Haus-Renderer (rendern-mobil.mjs aus p94-hig). Ein kleiner Server liefert die Wurzel
// des Repos aus, damit die Seiten app.css und das Sprite der App benutzen.
// Aufruf: node rendern.mjs PFAD-ZU-p94-hig AUSGABEORDNER
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [hig, aus] = process.argv.slice(2);
const wurzel = new URL('../../../../../', import.meta.url).pathname;
const TYP = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = createServer(async (q, a) => {
  const p = normalize(join(wurzel, decodeURIComponent(new URL(q.url, 'http://x').pathname)));
  try {
    if (!p.startsWith(wurzel)) throw new Error('außerhalb');
    const inhalt = await readFile(p);
    a.writeHead(200, { 'content-type': TYP[extname(p)] ?? 'application/octet-stream' });
    a.end(inhalt);
  } catch { a.writeHead(404); a.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const basis = `http://127.0.0.1:${server.address().port}`;
const seiten = ['a', 'b', 'b-blatt', 'c', 'c-filter'];
const kind = spawn(process.execPath, [`${hig}/beispiele/rendern-mobil.mjs`, '-o', aus, '--warte=600',
  ...seiten.map((s) => `${basis}/docs/entwicklung/ansichten/uebersicht/varianten/${s}.html#${s}`)], { stdio: 'inherit' });
kind.on('exit', (code) => { server.close(); process.exit(code ?? 1); });
