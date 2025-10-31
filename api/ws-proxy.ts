export const config = { runtime: 'edge' };

// Bridge: client <-> (this edge) <-> external ws
export default async function handler(req: Request): Promise<Response> {
  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  // Target WS URL from env or query string (query has precedence for debugging)
  const url = new URL(req.url);
  const targetFromQuery = url.searchParams.get('target') || '';
  // IMPORTANT: Use a distinct env for upstream to avoid proxying to itself when
  // frontend uses VITE_EMSC_WS_URL=/ws in production.
  const targetFromEnv =
    (process as any)?.env?.UPSTREAM_WS_URL ||
    (process as any)?.env?.EMSC_UPSTREAM_WS_URL ||
    '';
  const target = (targetFromQuery || targetFromEnv || '').toString().trim();

  if (!target) {
    return new Response('Missing upstream ws target', { status: 500 });
  }

  // Pair for client connection (client<->server)
  const pair = new (globalThis as any).WebSocketPair();
  const clientSocket = pair[0];
  const serverSocket = pair[1];

  serverSocket.accept();

  let upstream: any;
  try {
    // Initiate upstream WebSocket connection
    const proto = req.headers.get('sec-websocket-protocol') || undefined;
    const headers: Record<string, string> = {
      Upgrade: 'websocket',
      Connection: 'Upgrade',
    };
    if (proto) headers['Sec-WebSocket-Protocol'] = proto;

    const upstreamRes = await fetch(target, { headers });
    upstream = (upstreamRes as any).webSocket;
    if (!upstream) throw new Error('No upstream websocket in response');
    upstream.accept();
  } catch (err) {
    try { serverSocket.close(1011, 'Upstream connect failed'); } catch {}
    return new Response(null, { status: 101, webSocket: clientSocket });
  }

  const closeBoth = (code?: number, reason?: string) => {
    try { serverSocket.close(code, reason); } catch {}
    try { upstream.close(code, reason); } catch {}
  };

  // Pump messages both ways
  serverSocket.addEventListener('message', (ev: MessageEvent) => {
    try { upstream.send((ev as any).data); } catch { closeBoth(1011, 'Relay failed'); }
  });
  upstream.addEventListener('message', (ev: MessageEvent) => {
    try { serverSocket.send((ev as any).data); } catch { closeBoth(1011, 'Relay failed'); }
  });

  // Mirror close/error
  serverSocket.addEventListener('close', (ev: any) => {
    try { upstream.close(ev.code || 1000, ev.reason || 'Client closed'); } catch {}
  });
  upstream.addEventListener('close', (ev: any) => {
    try { serverSocket.close(ev.code || 1000, ev.reason || 'Upstream closed'); } catch {}
  });
  serverSocket.addEventListener('error', () => closeBoth(1011, 'Client error'));
  upstream.addEventListener('error', () => closeBoth(1011, 'Upstream error'));

  // Hand control to the runtime
  return new Response(null, { status: 101, webSocket: clientSocket });
}
