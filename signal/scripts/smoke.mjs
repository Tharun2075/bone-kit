// Two sockets, one topic: B must receive what A publishes. Usage: node scripts/smoke.mjs ws://127.0.0.1:8787
import WebSocket from 'ws';
const url = process.argv[2] ?? 'ws://127.0.0.1:8787';
const open = () => new Promise((res, rej) => { const w = new WebSocket(url); w.on('open', () => res(w)); w.on('error', rej); });
const [a, b] = await Promise.all([open(), open()]);
const got = new Promise((res) => b.on('message', (d) => { const m = JSON.parse(d); if (m.type === 'publish') res(m); }));
const pong = new Promise((res) => a.on('message', (d) => JSON.parse(d).type === 'pong' && res(true)));
for (const w of [a, b]) w.send(JSON.stringify({ type: 'subscribe', topics: ['smoke-room'] }));
a.send(JSON.stringify({ type: 'ping' }));
await pong;
await new Promise((r) => setTimeout(r, 300));
a.send(JSON.stringify({ type: 'publish', topic: 'smoke-room', data: 'hello' }));
const m = await Promise.race([got, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))]);
console.log('B received:', JSON.stringify(m));
if (m.data !== 'hello' || m.clients !== 2) process.exit(1);
a.close(); b.close();
process.exit(0);
