#!/usr/bin/env node
// Listen on a room's relay topic and print one line per message (who, type, ICE candidate kind). No payloads.
// Usage: node scripts/relay-probe.mjs <wss-url> <topic> [seconds]
import WebSocket from 'ws';
const [url, topic, secs = '300'] = process.argv.slice(2);
const ws = new WebSocket(url);
const t0 = Date.now();
const say = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`);
ws.on('open', () => { ws.send(JSON.stringify({ type: 'subscribe', topics: [topic] })); say(`subscribed ${topic}`); });
ws.on('message', (raw) => {
  const m = JSON.parse(String(raw));
  if (m.type !== 'publish') return;
  const d = m.data ?? {};
  const s = d.signal ?? {};
  const cand = s.candidate?.candidate ?? '';
  const kind = cand ? ` cand=${/ typ (\w+)/.exec(cand)?.[1]} ${/ (udp|tcp) /i.exec(cand)?.[1] ?? ''}` : '';
  say(`clients=${m.clients} ${d.type ?? d.t} from=${String(d.from).slice(0, 6)} to=${String(d.to ?? '').slice(0, 6)} sig=${s.type ?? ''}${kind}`);
});
setInterval(() => ws.send('{"type":"ping"}'), 20000);
setTimeout(() => process.exit(0), Number(secs) * 1000);
