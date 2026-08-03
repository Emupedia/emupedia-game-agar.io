import { decodeServer, hex } from "./protocol";
import { ClientOp, ServerOp } from "./opcodes";

export type Dir = ">" | ">*" | "<";

interface Rec {
  t: number;
  dir: Dir;
  op: number;
  len: number;
  buf: ArrayBuffer;
}

const td = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;

function cstrAt(dv: DataView, o: number): { s: string; next: number } {
  const bytes: number[] = [];
  let i = o;
  for (; i < dv.byteLength; i++) {
    const c = dv.getUint8(i);
    if (c === 0) { i++; break; }
    bytes.push(c);
  }
  const s = td ? td.decode(new Uint8Array(bytes)) : String.fromCharCode(...bytes);
  return { s, next: i };
}

function describe(dir: Dir, buf: ArrayBuffer): string {
  if (!buf.byteLength) return "(empty)";
  const dv = new DataView(buf);
  const op = dv.getUint8(0);
  const len = buf.byteLength;
  const u32 = (o: number) => (o + 4 <= len ? dv.getUint32(o, true) : 0);
  const i32 = (o: number) => (o + 4 <= len ? dv.getInt32(o, true) : 0);

  if (dir === "<") {
    switch (op) {
      case ServerOp.UPDATE_NODES:
        try {
          const e = decodeServer(buf);
          if (e.t === "world") return `UPDATE-NODES eats=${e.world.eats.length} nodes=${e.world.updates.length} removes=${e.world.removes.length}`;
        } catch {}
        return "UPDATE-NODES (?)";
      case ServerOp.OWN_CELL: {
        const ids: number[] = [];
        for (let o = 1; o + 4 <= len; o += 4) ids.push(u32(o));
        return `OWN-CELL id=${ids.join(",")}`;
      }
      case ServerOp.BORDER: {
        const b = (o: number) => (o + 8 <= len ? dv.getFloat64(o, true) : 0);
        const gm = len > 33 ? cstrAt(dv, 33).s : "";
        return `BORDER [${b(1) | 0},${b(9) | 0},${b(17) | 0},${b(25) | 0}]${gm ? ` "${gm}"` : ""}`;
      }
      case ServerOp.LEADERBOARD:
        try {
          const e = decodeServer(buf);
          if (e.t === "leaderboard") {
            const names = e.entries.map((x) => x.name || "-");
            return `LEADERBOARD ${e.entries.length}: ${names.slice(0, 6).join(", ")}${names.length > 6 ? " ..." : ""}`;
          }
        } catch {}
        return "LEADERBOARD";
      case ServerOp.CLEAR:
        return "CLEAR-NODES";
      case ServerOp.CHAT: {
        const r = dv.getUint8(2), g = dv.getUint8(3), b = dv.getUint8(4);
        const name = cstrAt(dv, 5);
        const text = cstrAt(dv, name.next);
        return `CHAT [${r},${g},${b}] ${name.s}: "${text.s}"`;
      }
      case ServerOp.STATUS:
        return len > 1 && dv.getUint8(1) === 0x7b ? `STATUS ${cstrAt(dv, 1).s.slice(0, 140)}` : `op254 (${len}B)`;
      default:
        return `op${op} (${len}B)`;
    }
  }

  switch (op) {
    case ClientOp.SET_PROTOCOL:
      return len === 5 ? `SET-PROTOCOL v${u32(1)}` : "PING";
    case ClientOp.HANDSHAKE:
      return `HANDSHAKE key=${u32(1)} nick="${cstrAt(dv, 5).s}"`;
    case ClientOp.SPAWN:
      return `SPAWN ${cstrAt(dv, 1).s}`;
    case ClientOp.MOUSE:
      return len >= 21 ? `MOVE(f64) x=${dv.getFloat64(1, true) | 0} y=${dv.getFloat64(9, true) | 0}` : `MOVE x=${i32(1)} y=${i32(5)}`;
    case 0:
      return `SPAWN-LEGACY(op0) "${cstrAt(dv, 1).s}"  [wrong opcode for this server]`;
    case ClientOp.SPECTATE:
      return "SPECTATE";
    case ClientOp.Q_DOWN:
      return "Q-DOWN (free roam)";
    case ClientOp.Q_UP:
      return "Q-UP (free roam)";
    case ClientOp.SPLIT:
      return "SPLIT";
    case ClientOp.EJECT:
      return "EJECT";
    default:
      return `op${op} (${len}B)`;
  }
}

export class PacketLog {
  private recs: Rec[] = [];
  private counts = new Map<string, number>();
  private cap = 4000;
  private enabled = false;
  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.recs.length = 0;
  }

  add(dir: Dir, buf: ArrayBuffer) {
    if (!buf || !buf.byteLength) return;
    const op = new Uint8Array(buf)[0];
    const key = `${dir}${op}`;
    const c = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, c);
    if (!this.enabled) return;
    if ((op === ServerOp.UPDATE_NODES || op === ClientOp.MOUSE || op === ServerOp.LEADERBOARD || op === ClientOp.SET_PROTOCOL) && c > 8 && c % 250 !== 0) return;
    this.recs.push({ t: Date.now(), dir, op, len: buf.byteLength, buf: buf.slice(0, 1024) });
    if (this.recs.length > this.cap) this.recs.shift();
  }

  summary(): string {
    return [...this.counts.entries()].sort().map(([k, v]) => `${k}x${v}`).join("  ");
  }

  private line(r: Rec): string {
    const ts = new Date(r.t).toISOString().slice(11, 23);
    return `${ts} ${r.dir} ${describe(r.dir, r.buf)}`;
  }

  tail(n: number): string[] {
    return this.recs.slice(-n).map((r) => this.line(r));
  }

  dump(): string {
    const head =
      `=== agarv2mod packet log (${this.recs.length} recs) - LIVE OgarII opcode map ===\n` +
      `legend: > game sent - >* we sent - < server received\n` +
      `summary: ${this.summary()}\n`;
    const body = this.recs
      .map((r) => `${this.line(r)}   ${hex(r.buf, 48)}`)
      .join("\n");
    return `${head}\n${body}`;
  }
}
