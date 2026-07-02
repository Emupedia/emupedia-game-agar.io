import type { ChatLog } from "./chat";
import type { PacketLog } from "./packetlog";
import { decodeServer, hex } from "./protocol";
import { currentProfile, settings } from "./settings";
import type { SkinShare } from "./skinshare";
import type { World } from "./world";

const GAME_SOCKET = /agar\.emupedia\.net|\/ws2\b/i;

function makeInertSocket(url: string): WebSocket {
  const et = new EventTarget();
  const stub = {
    url,
    readyState: 0,
    binaryType: "arraybuffer" as BinaryType,
    bufferedAmount: 0,
    extensions: "",
    protocol: "",
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send() {},
    close() {},
    addEventListener: (...a: Parameters<EventTarget["addEventListener"]>) => et.addEventListener(...a),
    removeEventListener: (...a: Parameters<EventTarget["removeEventListener"]>) => et.removeEventListener(...a),
    dispatchEvent: (e: Event) => et.dispatchEvent(e),
    CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
  };
  return stub as unknown as WebSocket;
}

function rewriteHandshakeNick(buf: ArrayBuffer): ArrayBuffer | null {
  try {
    if (buf.byteLength < 5) return null;
    const nick = (currentProfile().name || "An unnamed cell").slice(0, 15);
    const key = new DataView(buf).getUint32(1, true);
    const name = new TextEncoder().encode(nick);
    const out = new ArrayBuffer(5 + name.length + 1);
    const ov = new DataView(out);
    ov.setUint8(0, 255);
    ov.setUint32(1, key, true);
    new Uint8Array(out).set(name, 5);
    return out;
  } catch {
    return null;
  }
}

export interface HookStats {
  attached: boolean;
  url: string;
  frames: number;
  unknownOps: Set<number>;
  sends: ArrayBuffer[];
  wsProtocol?: string;
}

export interface GameLink {
  ws: WebSocket | null;
  suppressMove: boolean;
  suppressAction: boolean;
  suppressSpawn: boolean;
  sendRaw: ((buf: ArrayBuffer) => void) | null;
  blocked?: boolean;
}

export function installWsHook(
  world: World,
  stats: HookStats,
  link: GameLink,
  log: (...a: unknown[]) => void,
  packets: PacketLog,
  chat: ChatLog,
  skinShare: SkinShare,
) {
  const Native = window.WebSocket;
  if ((Native as unknown as { __agarHooked?: boolean }).__agarHooked) return;

  let loggedSends = 0;
  let loggedFrames = 0;
  let current: WebSocket | null = null;

  function Patched(this: unknown, url: string | URL, protocols?: string | string[]): WebSocket {
    const u = String(url);
    if (GAME_SOCKET.test(u) && link.blocked) {
      log("[agar-ext] WS1 reconnect suppressed (inert stub - no connection)");
      return makeInertSocket(u);
    }
    const ws = protocols !== undefined ? new Native(url, protocols) : new Native(url);
    if (GAME_SOCKET.test(u)) {
      current = ws;
      world.clear();
      stats.attached = true;
      stats.url = u;
      stats.wsProtocol = Array.isArray(protocols) ? protocols[0] : protocols;
      log("[agar-ext] hooked game socket:", u, stats.wsProtocol ? `subprotocol=${stats.wsProtocol.slice(0, 13)}` : "(no subprotocol)");
      try { ws.binaryType = "arraybuffer"; } catch {}

      const nativeSend = ws.send.bind(ws);
      link.sendRaw = (buf: ArrayBuffer) => {
        if (ws.readyState !== ws.OPEN) return;
        packets.add(">*", buf);
        nativeSend(buf as never);
      };
      ws.send = (data: Parameters<WebSocket["send"]>[0]) => {
        let buf =
          data instanceof ArrayBuffer
            ? data
            : ArrayBuffer.isView(data)
              ? (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength)
              : null;
        if (buf && buf.byteLength) {
          const op = new Uint8Array(buf)[0];
          if (op === 255) { const rw = rewriteHandshakeNick(buf); if (rw) { buf = rw; data = rw; } }
          packets.add(">", buf);
          if (!stats.sends.some((b) => b.byteLength && new Uint8Array(b)[0] === op)) {
            stats.sends.push(buf.slice(0));
            log(`[agar-ext] capture op ${op}`, hex(buf));
            void loggedSends;
          }
          if (
            (link.suppressSpawn && op === 20) ||
            (link.suppressMove && op === 5) ||
            (link.suppressAction && (op === 15 || op === 18))
          ) {
            return undefined as never;
          }
        }
        return nativeSend(data as never);
      };

      ws.addEventListener("message", (ev: MessageEvent) => {
        if (ws !== current) return;
        if (!(ev.data instanceof ArrayBuffer)) return;
        const buf = ev.data;
        packets.add("<", buf);
        if (!settings.game.spectatorView && buf.byteLength && new Uint8Array(buf)[0] !== 98) return;
        try {
          const e = decodeServer(buf);
          stats.frames++;
          switch (e.t) {
            case "world":
              world.apply(e.world);
              if (loggedFrames < 3) {
                log(
                  `[agar-ext] world: +${e.world.updates.length} ~ -${e.world.removes.length}`,
                  e.world.updates.slice(0, 3),
                );
                loggedFrames++;
              }
              break;
            case "border":
              world.border = e.border;
              log("[agar-ext] border", e.border);
              break;
            case "own":
              world.setOwn(e.ownIds);
              log("[agar-ext] own ids", e.ownIds);
              break;
            case "leaderboard":
              world.leaderboard = e.entries;
              break;
            case "chat":
              break;
            case "clear":
              world.clear();
              break;
            case "raw":
              if (!stats.unknownOps.has(e.op)) {
                stats.unknownOps.add(e.op);
                log("[agar-ext] unknown op", e.op, hex(buf));
              }
              break;
          }
        } catch (err) {
          log("[agar-ext] decode error", err, hex(buf));
        }
      });

      ws.addEventListener("close", (ev: CloseEvent) => {
        if (ws === current) log(`[agar-ext] GAME socket closed code=${ev.code} reason=${ev.reason || "-"}`);
      });
    }
    return ws;
  }

  Patched.prototype = Native.prototype;
  Patched.CONNECTING = Native.CONNECTING;
  Patched.OPEN = Native.OPEN;
  Patched.CLOSING = Native.CLOSING;
  Patched.CLOSED = Native.CLOSED;
  (Patched as unknown as { __agarHooked: boolean }).__agarHooked = true;
  (window as unknown as { __agarNativeWS?: typeof WebSocket }).__agarNativeWS = Native;

  window.WebSocket = Patched as unknown as typeof WebSocket;
  log("[agar-ext] WebSocket hook installed");
}
