export type MoveFormat = "i32" | "f64";

const MOVE_OP = 5;
const SPAWN_OP = 20;

export function encodeMove(x: number, y: number, fmt: MoveFormat): ArrayBuffer {
  if (fmt === "f64") {
    const b = new ArrayBuffer(21);
    const v = new DataView(b);
    v.setUint8(0, MOVE_OP);
    v.setFloat64(1, x, true);
    v.setFloat64(9, y, true);
    v.setUint32(17, 0, true);
    return b;
  }
  const b = new ArrayBuffer(13);
  const v = new DataView(b);
  v.setUint8(0, MOVE_OP);
  v.setInt32(1, Math.round(x), true);
  v.setInt32(5, Math.round(y), true);
  v.setUint32(9, 0, true);
  return b;
}

function tagField(v: string, max: number): string {
  return v.trim().replace(/[<>|]/g, "").slice(0, max);
}

export function encodeOgarSpawn(
  nick: string,
  fp2: string,
  skin = "",
  nameColor = "#ffffff",
  cellColor = "#ffffff",
  borderColor = "#ffffff",
): ArrayBuffer {
  const s = `<${tagField(skin, 30)}|${tagField(nameColor, 7)}|${tagField(cellColor, 7)}|${tagField(borderColor, 7)}||${tagField(fp2, 64)}>${nick}`;
  const utf8 = new TextEncoder().encode(s);
  const b = new ArrayBuffer(1 + utf8.length + 1);
  const bytes = new Uint8Array(b);
  bytes[0] = SPAWN_OP;
  bytes.set(utf8, 1);
  bytes[1 + utf8.length] = 0;
  return b;
}

export function encodeChat(message: string, op: number): ArrayBuffer {
  const utf8 = new TextEncoder().encode(message);
  const b = new ArrayBuffer(2 + utf8.length + 1);
  const bytes = new Uint8Array(b);
  bytes[0] = op;
  bytes[1] = 0;
  bytes.set(utf8, 2);
  bytes[2 + utf8.length] = 0;
  return b;
}
