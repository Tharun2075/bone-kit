# @bone-kit/signal

A y-webrtc signalling relay for Cloudflare Workers: one Durable Object (SQLite-backed, free plan) using the WebSocket Hibernation API. Speaks the y-webrtc protocol (`subscribe`, `unsubscribe`, `publish`, `ping`/`pong`) and fans each `publish` out to the other sockets subscribed to that topic.

Run locally: `npm run dev -w @bone-kit/signal` (port 8787), check with `npm run smoke -w @bone-kit/signal -- ws://127.0.0.1:8787`.
Point an app at it: build seance-board with `VITE_SIGNAL_URL=wss://<your-worker>` (empty by default: same-device BroadcastChannel only).
Deploy is manual (`wrangler deploy`), not part of the build.

## Signalling relay: what it sees and stores (nothing but room ids in memory)

- It sees: room ids (topics) and the opaque signalling messages peers publish (WebRTC offers/answers and ICE candidates), plus the connection's IP as any server does.
- It stores: nothing on disk. No database writes, no KV, no logs of message bodies, room ids or IPs. Topic membership lives in memory only and vanishes when the object is evicted.
- It never sees post content: posts travel peer to peer over WebRTC data channels, not through the relay.
- Caps: messages over 64 KB are refused; a socket may subscribe to at most 32 topics.
