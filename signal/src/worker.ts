import { DurableObject } from 'cloudflare:workers';
import { Hub, handle } from './hub';

interface Env {
  RELAY: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('okay', { headers: { 'content-type': 'text/plain' } });
    // One relay object for everything: it holds only room ids in memory, so a demo-sized crowd fits.
    return env.RELAY.get(env.RELAY.idFromName('relay')).fetch(req);
  },
};

/** Holds the sockets (WebSocket Hibernation API). Topics live in memory and in each socket's 2 KB attachment; nothing is written to storage and nothing is logged. */
export class Relay extends DurableObject<Env> {
  private hub = new Hub<WebSocket>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Rebuild after hibernation from what each socket carries.
    for (const ws of ctx.getWebSockets()) this.hub.subscribe(ws, ws.deserializeAttachment() ?? []);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'));
  }

  async fetch(_req: Request): Promise<Response> {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): void {
    if (typeof data !== 'string') return ws.close(1003, 'text only');
    const out = handle(this.hub, ws, data);
    if (out.kind === 'reject') return ws.close(1009, 'message too big or not JSON');
    if (out.kind === 'reply') ws.send(JSON.stringify(out.reply));
    else if (out.kind === 'subscribed') ws.serializeAttachment(out.topics);
    else if (out.kind === 'fanout') for (const r of out.to) try { r.send(out.payload); } catch { /* peer gone */ }
  }

  webSocketClose(ws: WebSocket): void {
    this.hub.remove(ws);
    try { ws.close(); } catch { /* already closed */ }
  }

  webSocketError(ws: WebSocket): void {
    this.hub.remove(ws);
  }
}
