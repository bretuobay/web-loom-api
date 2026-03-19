/**
 * Cloudflare Durable Objects support for WebSocket management.
 *
 * Provides a WebSocket Durable Object class that manages connections,
 * supports broadcasting, and tracks connected clients.
 */

/** Minimal WebSocket interface for Durable Object context */
export interface DOWebSocket {
  accept(): void;
  send(message: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

/** WebSocket message event */
export interface WebSocketMessageEvent {
  data: string | ArrayBuffer;
}

/** WebSocket close event */
export interface WebSocketCloseEvent {
  code: number;
  reason: string;
}

/** Connection metadata */
export interface ConnectionInfo {
  id: string;
  connectedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * WebSocket Durable Object for managing persistent WebSocket connections.
 *
 * @example
 * ```ts
 * // In wrangler.toml, bind a Durable Object namespace
 * // Then in your handler:
 * const id = env.WEBSOCKET.idFromName('room-1');
 * const obj = env.WEBSOCKET.get(id);
 * return obj.fetch(request);
 * ```
 */
export class WebSocketDurableObject {
  private connections = new Map<string, DOWebSocket>();
  private connectionInfo = new Map<string, ConnectionInfo>();
  private nextId = 1;

  /**
   * Handle an incoming fetch request.
   * If it's a WebSocket upgrade, accept and track the connection.
   */
  async handleWebSocket(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Create a WebSocket pair (server/client)
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket & DOWebSocket];

    const connectionId = String(this.nextId++);

    server.accept();
    this.connections.set(connectionId, server);
    this.connectionInfo.set(connectionId, {
      id: connectionId,
      connectedAt: Date.now(),
    });

    server.addEventListener('message', (event: unknown) => {
      // Subclasses can override onMessage for custom handling
      this.onMessage(connectionId, event as WebSocketMessageEvent);
    });

    server.addEventListener('close', (event: unknown) => {
      this.connections.delete(connectionId);
      this.connectionInfo.delete(connectionId);
      this.onClose(connectionId, event as WebSocketCloseEvent);
    });

    server.addEventListener('error', () => {
      this.connections.delete(connectionId);
      this.connectionInfo.delete(connectionId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit & { webSocket: WebSocket });
  }

  /**
   * Broadcast a message to all connected WebSocket clients.
   */
  broadcast(message: string | ArrayBuffer): void {
    for (const [id, ws] of this.connections) {
      try {
        ws.send(message);
      } catch {
        // Connection is broken, clean up
        this.connections.delete(id);
        this.connectionInfo.delete(id);
      }
    }
  }

  /**
   * Send a message to a specific connection by ID.
   */
  send(id: string, message: string | ArrayBuffer): boolean {
    const ws = this.connections.get(id);
    if (!ws) return false;
    try {
      ws.send(message);
      return true;
    } catch {
      this.connections.delete(id);
      this.connectionInfo.delete(id);
      return false;
    }
  }

  /**
   * Get the number of active connections.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get info about all active connections.
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connectionInfo.values());
  }

  /**
   * Override in subclasses to handle incoming messages.
   */
  protected onMessage(_connectionId: string, _event: WebSocketMessageEvent): void {
    // Default: no-op. Override in subclass.
  }

  /**
   * Override in subclasses to handle connection close.
   */
  protected onClose(_connectionId: string, _event: WebSocketCloseEvent): void {
    // Default: no-op. Override in subclass.
  }
}
