#!/usr/bin/env node
// Probes y-webrtc signalling servers in parallel: opens a WebSocket, sends subscribe + ping, expects a pong. Our relay is first; exit 0 only when the first URL answers. Usage: node scripts/sigcheck.mjs [wss://url ...]
import WebSocket from 'ws';
const urls = process.argv.slice(2).length ? process.argv.slice(2) : [
  process.env.VITE_SIGNAL_URL || 'wss://bone-kit-signal.picchess.workers.dev', // our relay (repo/signal Worker)
  'wss://y-webrtc-eu.fly.dev', // default in y-webrtc 10.3.0 source; README servers removed 2026-11-14 (dead: ENOTFOUND, 404, 404)
];
const probe = (url) => new Promise((resolve) => {
  const t = setTimeout(() => { ws.terminate(); resolve('TIMEOUT (10 s)'); }, 10000);
  const ws = new WebSocket(url);
  ws.on('open', () => { ws.send(JSON.stringify({ type: 'subscribe', topics: ['bone-kit-probe'] })); ws.send(JSON.stringify({ type: 'ping' })); });
  ws.on('message', (m) => { if (JSON.parse(m).type === 'pong') { clearTimeout(t); ws.close(); resolve('ANSWERS (pong)'); } });
  ws.on('unexpected-response', (_r, res) => { clearTimeout(t); resolve(`DOWN (HTTP ${res.statusCode})`); });
  ws.on('error', (e) => { clearTimeout(t); resolve(`DOWN (${e.code ?? e.message})`); });
});
const res = await Promise.all(urls.map(probe)); process.stdout.write(urls.map((u, i) => `${u}\t${res[i]}\n`).join(''), () => process.exit(res[0].startsWith('ANSWERS') ? 0 : 1)); // parallel + exit: a dead server can no longer hang the run
