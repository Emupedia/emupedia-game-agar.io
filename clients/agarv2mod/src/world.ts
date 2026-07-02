import type { Border, LeaderEntry, WorldUpdate } from "./protocol";
import { formatMass, settings } from "./settings";

export interface RNode {
  id: number;
  x: number;
  y: number;
  size: number;
  isVirus: boolean;
  r: number;
  g: number;
  b: number;
  css: string;
  name: string;
  skin: string;
  skinUrl: string;
  born: number;
  rx: number;
  ry: number;
  rsize: number;
  dispMass: number;
  massStr: string;
}

const SKIN_PROXY = "https://agar2.emupedia.net/skin/";

function hexEncode(s: string): string {
  const enc = encodeURIComponent(s);
  let out = "";
  for (const ch of enc) out += ch.codePointAt(0)!.toString(16).padStart(2, "0");
  return out;
}

function hexDecode(s: string): string {
  const pairs = s.match(/../g);
  if (!pairs) return "";
  let out = "";
  for (const h of pairs) out += String.fromCodePoint(parseInt(h, 16));
  try { return decodeURIComponent(out); } catch { return out; }
}

export function resolveSkinUrl(raw: string, name: string): string {
  if (!raw) return "";
  const parts = raw.split("|");
  let skin = parts[0].trim();
  if (skin.startsWith("%")) skin = skin.slice(1);
  if (skin.length >= 8 && skin.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(skin)) {
    const dec = hexDecode(skin);
    if (dec.startsWith("https://iili.io/")) skin = dec;
  }
  if (!skin) return "";
  if (skin.startsWith("https://iili.io/") && !skin.endsWith(".gif")) {
    const fp2 = (parts[5] ?? "").trim();
    return `${SKIN_PROXY}${hexEncode(skin)}?nick=${encodeURIComponent(name)}&fp2=${encodeURIComponent(fp2)}`;
  }
  if (/^https?:\/\//i.test(skin)) return skin;
  if (!/^[\w .-]+$/.test(skin)) return "";
  try {
    return new URL(`skins/${encodeURIComponent(skin)}.png`, location.href).href;
  } catch {
    return "";
  }
}

export class World {
  nodes = new Map<number, RNode>();
  ownIds = new Set<number>();
  border: Border = { minX: -8000, minY: -8000, maxX: 8000, maxY: 8000 };
  leaderboard: LeaderEntry[] = [];
  specCam: { x: number; y: number; at: number } | null = null;
  spawnFxAt = -1e9;

  get scrambleX() { return (this.border.minX + this.border.maxX) / 2; }
  get scrambleY() { return (this.border.minY + this.border.maxY) / 2; }

  apply(u: WorldUpdate) {
    const now = performance.now();
    for (const e of u.eats) { this.nodes.delete(e.id); this.ownIds.delete(e.id); }
    for (const n of u.updates) {
      const ex = this.nodes.get(n.id);
      if (ex) {
        ex.x = n.x; ex.y = n.y; ex.size = n.size;
        ex.isVirus = n.isVirus;
        if (n.color) { ex.r = n.color.r; ex.g = n.color.g; ex.b = n.color.b; ex.css = `rgb(${ex.r},${ex.g},${ex.b})`; }
        let reskin = false;
        if (n.name !== null && n.name !== ex.name) { ex.name = n.name; reskin = true; }
        if (n.skin !== null && n.skin !== ex.skin) { ex.skin = n.skin; reskin = true; }
        if (reskin) ex.skinUrl = resolveSkinUrl(ex.skin, ex.name);
      } else {
        const cr = n.color ? n.color.r : 220;
        const cg = n.color ? n.color.g : 220;
        const cb = n.color ? n.color.b : 220;
        this.nodes.set(n.id, {
          id: n.id, x: n.x, y: n.y, size: n.size, isVirus: n.isVirus,
          r: cr, g: cg, b: cb, css: `rgb(${cr},${cg},${cb})`,
          name: n.name ?? "",
          skin: n.skin ?? "",
          skinUrl: resolveSkinUrl(n.skin ?? "", n.name ?? ""),
          born: now,
          rx: n.x, ry: n.y, rsize: n.size,
          dispMass: (n.size * n.size) / 100,
          massStr: (n.name || n.size >= 40) ? formatMass((n.size * n.size) / 100, settings.theme.massFormat) : "",
        });
      }
    }
    for (const id of u.removes) { this.nodes.delete(id); this.ownIds.delete(id); }
  }

  setOwn(ids: number[]) {
    const now = performance.now();
    for (const id of ids) {
      if (!this.ownIds.has(id)) {
        const n = this.nodes.get(id);
        if (n) n.born = now;
        this.ownIds.add(id);
      }
    }
  }

  clear() {
    this.nodes.clear();
    this.ownIds.clear();
  }

  private massAccum = 0;

  step(dt: number) {
    const delay = Math.max(20, Math.min(400, settings.game.drawDelay || 70));
    const k = 1 - Math.exp((-1000 / delay) * dt);
    this.massAccum += dt;
    const refreshMass = this.massAccum >= 0.5;
    if (refreshMass) this.massAccum = 0;
    for (const n of this.nodes.values()) {
      n.rx += (n.x - n.rx) * k;
      n.ry += (n.y - n.ry) * k;
      n.rsize += (n.size - n.rsize) * k;
      if (refreshMass) {
        n.dispMass = (n.size * n.size) / 100;
        if (n.name || n.rsize >= 40) n.massStr = formatMass(n.dispMass, settings.theme.massFormat);
      }
    }
  }

  ownCenter(): { cx: number; cy: number; radius: number } | null {
    let cx = 0, cy = 0, n = 0, maxR = 0;
    for (const id of this.ownIds) {
      const node = this.nodes.get(id);
      if (!node) continue;
      cx += node.rx;
      cy += node.ry;
      n++;
      maxR = Math.max(maxR, node.rsize);
    }
    return n ? { cx: cx / n, cy: cy / n, radius: maxR } : null;
  }
}
