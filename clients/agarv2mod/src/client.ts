import { decodeServer, hex } from "./protocol";
import { World } from "./world";

const PING = new Uint8Array([254]).buffer;
const KEEPALIVE_MS = 5000;

const WS_TOKEN_SECRET = "tFoL46WDlZuRja7W6qCl";
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function mintWsToken(): Promise<string> {
  const ts = Date.now().toString();
  const uuid = crypto.randomUUID().replaceAll("-", "");
  const hash = await sha256Hex([ts, uuid, location.origin, WS_TOKEN_SECRET].join("."));
  return `${ts}.${uuid}.${hash}`;
}

export class SocketClient {
  ws: WebSocket | null = null;
  world = new World();
  open = false;
  worldEnabled = true;
  ping = 0;
  private pingTimer = 0;
  private lastPingAt = 0;
  private awaitingPong = false;
  private pingSamples: number[] = [];

  constructor(
    private label: string,
    private url: string,
    private handshake: ArrayBuffer[],
    private log: (...a: unknown[]) => void,
    private onChat?: (name: string, message: string, color: string) => void,
  ) {}

  async connect() {
    this.stopPing();
    let token: string;
    try {
      token = await mintWsToken();
    } catch (e) {
      this.log(`[agarv2mod] ${this.label}: token mint failed`, e);
      return;
    }
    this.log(`[agarv2mod] ${this.label}: connecting`, this.url.slice(0, 80), `proto=${token.slice(0, 13)}`);
    const WS = (window as unknown as { __agarNativeWS?: typeof WebSocket }).__agarNativeWS ?? window.WebSocket;
    let ws: WebSocket;
    try {
      ws = new WS(this.url, token);
    } catch (e) {
      this.log(`[agarv2mod] ${this.label}: connect threw`, e);
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.log(`[agarv2mod] ${this.label}: open - replaying ${this.handshake.length} handshake packet(s)`);
      for (const h of this.handshake) {
        try { ws.send(h); } catch (e) { this.log(`${this.label} send err`, e); }
      }
      this.open = true;
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      if (this.awaitingPong) {
        this.awaitingPong = false;
        const sample = performance.now() - this.lastPingAt;
        this.pingSamples.push(sample);
        if (this.pingSamples.length > 8) this.pingSamples.shift();
        this.ping = Math.round(Math.min(...this.pingSamples));
      }
      if (!this.worldEnabled && new Uint8Array(ev.data)[0] === 16) return;
      try {
        const e = decodeServer(ev.data);
        switch (e.t) {
          case "world": this.world.apply(e.world); break;
          case "border": this.world.border = e.border; break;
          case "own": this.world.setOwn(e.ownIds); break;
          case "leaderboard": this.world.leaderboard = e.entries; break;
          case "chat": this.onChat?.(e.name, e.message, e.color); break;
          case "clear": this.world.clear(); break;
          case "raw": break;
        }
      } catch (err) {
        this.log(`[agarv2mod] ${this.label}: decode error`, err, hex(ev.data));
      }
    });

    ws.addEventListener("close", (ev: CloseEvent) => {
      if (this.ws === ws) this.open = false;
      this.log(`[agarv2mod] ${this.label}: closed code=${ev.code} reason=${ev.reason || "-"}`);
    });
    ws.addEventListener("error", () => this.log(`[agarv2mod] ${this.label}: socket error`));

    this.pingTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.lastPingAt = performance.now();
          this.awaitingPong = true;
          this.ws.send(PING);
        } catch {}
      }
    }, KEEPALIVE_MS);
  }

  private stopPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = 0; }
    this.awaitingPong = false;
  }

  setHandshake(h: ArrayBuffer[]) { this.handshake = h; }

  reconnect() {
    this.log(`[agarv2mod] ${this.label}: leaving + rejoining`);
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.open = false;
    this.world.clear();
    void this.connect();
  }

  hasCell(): boolean {
    for (const id of this.world.ownIds) if (this.world.nodes.has(id)) return true;
    return false;
  }

  send(buf: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(buf);
  }

  close() {
    this.stopPing();
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.open = false;
  }
}
