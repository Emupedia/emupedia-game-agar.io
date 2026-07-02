export const COORD: "i16" | "i32" = "i32";

export class Reader {
  private view: DataView;
  off = 0;
  constructor(buf: ArrayBuffer) {
    this.view = new DataView(buf);
  }
  get remaining(): number {
    return this.view.byteLength - this.off;
  }
  u8() { const v = this.view.getUint8(this.off); this.off += 1; return v; }
  u16() { const v = this.view.getUint16(this.off, true); this.off += 2; return v; }
  i16() { const v = this.view.getInt16(this.off, true); this.off += 2; return v; }
  u32() { const v = this.view.getUint32(this.off, true); this.off += 4; return v; }
  i32() { const v = this.view.getInt32(this.off, true); this.off += 4; return v; }
  f32() { const v = this.view.getFloat32(this.off, true); this.off += 4; return v; }
  f64() { const v = this.view.getFloat64(this.off, true); this.off += 8; return v; }
  coord() { return COORD === "i16" ? this.i16() : this.i32(); }
  str8() {
    const bytes: number[] = [];
    for (;;) {
      if (this.remaining < 1) break;
      const c = this.u8();
      if (c === 0) break;
      bytes.push(c);
    }
    return decodeUtf8(bytes);
  }
  str16() {
    let s = "";
    for (;;) {
      if (this.remaining < 2) break;
      const c = this.u16();
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }
}

const UTF8 = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
function decodeUtf8(bytes: number[]): string {
  if (UTF8) return UTF8.decode(new Uint8Array(bytes));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

export interface AgarNode {
  id: number;
  x: number;
  y: number;
  size: number;
  isVirus: boolean;
  color: { r: number; g: number; b: number } | null;
  name: string | null;
  skin: string | null;
}

export interface WorldUpdate {
  eats: { by: number; id: number }[];
  updates: AgarNode[];
  removes: number[];
}

export interface Border {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function decodeUpdateNodes(r: Reader): WorldUpdate {
  const coordBytes = COORD === "i16" ? 2 : 4;
  const eats: { by: number; id: number }[] = [];
  const eatCount = r.remaining >= 2 ? r.u16() : 0;
  for (let i = 0; i < eatCount && r.remaining >= 8; i++) eats.push({ by: r.u32(), id: r.u32() });

  const updates: AgarNode[] = [];
  for (;;) {
    if (r.remaining < 4) break;
    const id = r.u32();
    if (id === 0) break;
    if (r.remaining < coordBytes * 2 + 3) break;
    const x = r.coord();
    const y = r.coord();
    const size = r.u16();
    const flags = r.u8();
    if (flags & 0x80) { if (r.remaining < 1) break; r.u8(); }
    const isVirus = (flags & 0x01) !== 0;
    let color: AgarNode["color"] = null;
    if (flags & 0x02) { if (r.remaining < 3) break; color = { r: r.u8(), g: r.u8(), b: r.u8() }; }
    const skin = flags & 0x04 ? r.str8() : null;
    const name = flags & 0x08 ? r.str8() : null;
    updates.push({ id, x, y, size, isVirus, color, name, skin });
  }

  const removes: number[] = [];
  const removeCount = r.remaining >= 2 ? r.u16() : 0;
  for (let i = 0; i < removeCount && r.remaining >= 4; i++) removes.push(r.u32());
  return { eats, updates, removes };
}

export function decodeBorder(r: Reader): Border {
  return { minX: r.f64(), minY: r.f64(), maxX: r.f64(), maxY: r.f64() };
}

export interface LeaderEntry {
  id: number;
  name: string;
}

export function decodeLeaderboard(r: Reader): LeaderEntry[] {
  const out: LeaderEntry[] = [];
  const count = r.u32();
  if (count > 100) return out;
  for (let i = 0; i < count && r.remaining >= 4; i++) {
    const id = r.u32();
    out.push({ id, name: r.str8() });
  }
  return out;
}

export type ServerEvent =
  | { t: "world"; world: WorldUpdate }
  | { t: "border"; border: Border }
  | { t: "own"; ownIds: number[] }
  | { t: "leaderboard"; entries: LeaderEntry[] }
  | { t: "chat"; name: string; message: string; color: string }
  | { t: "clear" }
  | { t: "raw"; op: number; len: number };

export function decodeServer(buf: ArrayBuffer): ServerEvent {
  const r = new Reader(buf);
  const op = r.u8();
  switch (op) {
    case 16:
      return { t: "world", world: decodeUpdateNodes(r) };
    case 64:
      return { t: "border", border: decodeBorder(r) };
    case 32: {
      const ownIds: number[] = [];
      while (r.remaining >= 4) ownIds.push(r.u32());
      return { t: "own", ownIds };
    }
    case 49:
      return { t: "leaderboard", entries: decodeLeaderboard(r) };
    case 98: {
      const flags = r.u8();
      const cr = r.u8(), cg = r.u8(), cb = r.u8();
      void flags;
      const name = r.str8();
      const message = r.str8();
      return { t: "chat", name, message, color: `rgb(${cr},${cg},${cb})` };
    }
    case 20:
      return { t: "clear" };
    default:
      return { t: "raw", op, len: buf.byteLength };
  }
}

export function hex(buf: ArrayBuffer, max = 48): string {
  const u = new Uint8Array(buf);
  const n = Math.min(u.length, max);
  let s = "";
  for (let i = 0; i < n; i++) s += u[i].toString(16).padStart(2, "0") + " ";
  return `${s}(${u.length}B)`;
}
