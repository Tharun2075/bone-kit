#!/usr/bin/env node
// Probes y-webrtc signalling servers: opens a WebSocket, sends subscribe + ping, expects a pong. Usage: node scripts/sigcheck.mjs [wss://url ...]
import WebSocket from 'ws';
const urls = process.argv.slice(2).length ? process.argv.slice(2) : [
  'wss://y-webrtc-eu.fly.dev', // default in y-webrtc 10.3.0 source
  'wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com', 'wss://y-webrtc-signaling-us.herokuapp.com', // listed in its README
];
const probe = (url) => new Promise((resolve) => {
  const t = setTimeout(() => { ws.terminate(); resolve('TIMEOUT (10 s)'); }, 10000);
  const ws = new WebSocket(url);
  ws.on('open', () => { ws.send(JSON.stringify({ type: 'subscribe', topics: ['bone-kit-probe'] })); ws.send(JSON.stringify({ type: 'ping' })); });
  ws.on('message', (m) => { if (JSON.parse(m).type === 'pong') { clearTimeout(t); ws.close(); resolve('ANSWERS (pong)'); } });
  ws.on('unexpected-response', (_r, res) => { clearTimeout(t); resolve(`DOWN (HTTP ${res.statusCode})`); });
  ws.on('error', (e) => { clearTimeout(t); resolve(`DOWN (${e.code ?? e.message})`); });
});
for (const u of urls) console.log(`${u}\t${await probe(u)}`);
