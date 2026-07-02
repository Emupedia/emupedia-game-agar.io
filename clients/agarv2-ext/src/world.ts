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
  rx: number;
  ry: number;
  rsize: number;
  dispMass: number;
  massStr: string;
}

export class World {
  nodes = new Map<number, RNode>();
  ownIds = new Set<number>();
  border: Border = { minX: -8000, minY: -8000, maxX: 8000, maxY: 8000 };
  leaderboard: LeaderEntry[] = [];

  get scrambleX() { return (this.border.minX + this.border.maxX) / 2; }
  get scrambleY() { return (this.border.minY + this.border.maxY) / 2; }

  apply(u: WorldUpdate) {
    for (const e of u.eats) { this.nodes.delete(e.id); this.ownIds.delete(e.id); }
    for (const n of u.updates) {
      const ex = this.nodes.get(n.id);
      if (ex) {
        ex.x = n.x; ex.y = n.y; ex.size = n.size;
        ex.isVirus = n.isVirus;
        if (n.color) { ex.r = n.color.r; ex.g = n.color.g; ex.b = n.color.b; ex.css = `rgb(${ex.r},${ex.g},${ex.b})`; }
        if (n.name !== null) ex.name = n.name;
        if (n.skin !== null) ex.skin = n.skin;
      } else {
        const cr = n.color ? n.color.r : 220;
        const cg = n.color ? n.color.g : 220;
        const cb = n.color ? n.color.b : 220;
        this.nodes.set(n.id, {
          id: n.id, x: n.x, y: n.y, size: n.size, isVirus: n.isVirus,
          r: cr, g: cg, b: cb, css: `rgb(${cr},${cg},${cb})`,
          name: n.name ?? "",
          skin: n.skin ?? "",
          rx: n.x, ry: n.y, rsize: n.size,
          dispMass: (n.size * n.size) / 100,
          massStr: (n.name || n.size >= 40) ? formatMass((n.size * n.size) / 100, settings.theme.massFormat) : "",
        });
      }
    }
    for (const id of u.removes) { this.nodes.delete(id); this.ownIds.delete(id); }
  }

  setOwn(ids: number[]) {
    for (const id of ids) this.ownIds.add(id);
  }

  clear() {
    this.nodes.clear();
    this.ownIds.clear();
  }

  private massAccum = 0;

  step(dt: number) {
    const k = 1 - Math.exp(-14 * dt);
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
