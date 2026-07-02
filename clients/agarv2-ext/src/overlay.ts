import { Camera } from "../../web/lib/game/Camera";
import type { Border } from "./protocol";
import { currentProfile, settings } from "./settings";
import type { RNode, World } from "./world";

export interface SceneLayer {
  world: World;
  active: boolean;
}

export interface SceneTheme {
  grid: boolean;
  names: boolean;
  mass: boolean;
  minimap: boolean;
  shadows: boolean;
  customSkins: boolean;
  gameSkins: boolean;
  massFormat: "auto" | "short" | "full";
  ringSize: number;
  pelletColor: string;
  showPellets: boolean;
  animatedBorder: boolean;
  spawnEffects: boolean;
  backgroundColor: string;
  backgroundUrl: string;
  activeOutline: string;
  inactiveOutline: string;
}

export interface Scene {
  layers(): SceneLayer[];
  cameraTarget(): { cx: number; cy: number; radius: number } | null;
  worldBorder(): Border;
  themeFor(): SceneTheme;
  sharedSkin(name: string): string;
}

const MAX_VIEW = 30000;
const AUTO_MAX_VIEW = 11000;
const MAX_CELLS = 600;
const MAX_FOOD = 1200;
const FULL_BUDGET = 240;

const FOOD_BUCKET_COLORS: string[] = Array.from({ length: 64 }, (_, k) => {
  const r = (k >> 4) * 85,
    g = ((k >> 2) & 3) * 85,
    b = (k & 3) * 85;
  return `rgb(${r},${g},${b})`;
});

class ImageCache {
  private images = new Map<string, HTMLImageElement>();
  private failed = new Set<string>();
  get(url: string): HTMLImageElement | null {
    if (!url || this.failed.has(url)) return null;
    let img = this.images.get(url);
    if (!img) {
      img = new Image();
      img.onerror = () => this.failed.add(url);
      img.src = url;
      this.images.set(url, img);
      return null;
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
}

class NameCache {
  private map = new Map<string, { canvas: HTMLCanvasElement; hScale: number; aspect: number }>();
  private static REF = 44;
  private static measure: CanvasRenderingContext2D | null = null;
  private builtThisFrame = 0;
  private static MAX_PER_FRAME = 2;

  beginFrame() { this.builtThisFrame = 0; }

  get(name: string): { canvas: HTMLCanvasElement; hScale: number; aspect: number } | null {
    const e = this.map.get(name);
    if (e) return e;
    if (this.builtThisFrame >= NameCache.MAX_PER_FRAME) return null;
    let m = NameCache.measure;
    if (!m) { m = NameCache.measure = document.createElement("canvas").getContext("2d"); if (!m) return null; }
    const ref = NameCache.REF;
    const pad = Math.ceil(ref * 0.35);
    const font = `${ref}px system-ui, sans-serif`;
    m.font = font;
    const w = Math.max(1, Math.ceil(m.measureText(name).width)) + pad * 2;
    const h = ref + pad * 2;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return null;
    cx.font = font;
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.lineWidth = Math.max(2, ref * 0.12);
    cx.strokeStyle = "rgba(0,0,0,0.5)";
    cx.fillStyle = "rgba(255,255,255,0.95)";
    cx.strokeText(name, w / 2, h / 2);
    cx.fillText(name, w / 2, h / 2);
    if (this.map.size > 400) this.map.clear();
    const built = { canvas: c, hScale: h / ref, aspect: w / h };
    this.map.set(name, built);
    this.builtThisFrame++;
    return built;
  }
}

class FpsSampler {
  private samplerIndex = 0;
  private sampler: Float32Array;
  private size = 0;
  average = 0;
  constructor(size = 100) {
    this.sampler = new Float32Array(size);
  }
  reset() {
    this.samplerIndex = 0;
    this.size = 0;
    this.average = 0;
    this.sampler.fill(0);
  }
  step(fps: number): number {
    this.sampler[this.samplerIndex] = Math.round(fps);
    this.samplerIndex = (this.samplerIndex + 1) % this.sampler.length;
    if (this.size < this.sampler.length) this.size++;
    let sum = 0;
    for (let i = 0; i < this.size; i++) sum += this.sampler[i];
    this.average = this.size ? Math.round(sum / this.size) : 0;
    return this.average;
  }
}

const REFRESH_LADDER = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240, 360];
function snapRefresh(fps: number): number {
  let best = 60, bestD = Infinity;
  for (const r of REFRESH_LADDER) { const d = Math.abs(r - fps); if (d < bestD) { bestD = d; best = r; } }
  return bestD <= best * 0.1 ? best : Math.max(30, Math.min(360, Math.round(fps)));
}

interface FoodEntry { n: RNode; x: number; y: number; r: number; }
interface CellEntry { n: RNode; x: number; y: number; r: number; outline: string | null; skin: string; mine: boolean; virus: boolean; fx: boolean; }

export class Overlay {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera = new Camera();
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private lastScale = 1;
  private raf = 0;
  private last = performance.now();
  private userZoom = 1;
  private images = new ImageCache();
  private names = new NameCache();
  private layers: SceneLayer[] = [];
  private _food: FoodEntry[] = [];
  private _viruses: CellEntry[] = [];
  private _cellPool: CellEntry[] = [];
  private _cells: CellEntry[] = [];
  private _cellMap = new Map<number, CellEntry>();
  private _seen = new Set<number>();
  private _foodBuckets: FoodEntry[][] = Array.from({ length: 64 }, () => []);
  private _cellBuckets: CellEntry[][] = Array.from({ length: 64 }, () => []);
  fps = 0;
  private fpsSampler = new FpsSampler(100);
  stalls = 0;
  lastStallMs = 0;
  detectedFps = 0;
  private _rawLast = performance.now();
  private _rawDeltas: number[] = [];
  private _rawIdx = 0;
  private _sinceEstimate = 0;
  drawMs = 0;
  dbgCells = 0;
  dbgFood = 0;
  dbgNodes = 0;
  visible = true;
  private disposed = false;
  private menuPoll = 0;
  private menuOpen = false;

  constructor(private scene: Scene) {
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "2147483640",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;

    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener(
      "wheel",
      (e) => {
        this.userZoom *= e.deltaY < 0 ? 1.12 : 0.89;
        this.userZoom = Math.max(0.2, Math.min(5, this.userZoom));
      },
      { passive: true },
    );
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) { this._rawDeltas.length = 0; this._rawIdx = 0; this._rawLast = performance.now(); }
    });
    document.documentElement.appendChild(this.canvas);
    (this.loop as { __hsloKeep?: boolean }).__hsloKeep = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.canvas.style.display = v ? "block" : "none";
  }

  snapCamera() {
    this.camera.snap();
  }

  screenToWorld(sx: number, sy: number) {
    return this.camera.screenToWorld(sx, sy);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.lastScale = settings.game.renderScale || 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2) * this.lastScale;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.setViewport(w, h);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const raw = now - this._rawLast; this._rawLast = now;
    if (raw >= 100 && raw < 2000) { this.stalls++; this.lastStallMs = Math.round(raw); }
    if (raw > 0 && raw < 100) {
      const buf = this._rawDeltas;
      if (buf.length < 180) buf.push(raw);
      else { buf[this._rawIdx] = raw; this._rawIdx = (this._rawIdx + 1) % 180; }
    }
    if (++this._sinceEstimate >= 60) { this._sinceEstimate = 0; this.estimateRefresh(); }

    if (++this.menuPoll >= 20) {
      this.menuPoll = 0;
      this.menuOpen = !!document.querySelector(".agx-overlay.agx-open");
    }
    let threshold = 0;
    if (settings.game.autoFps && this.detectedFps > 0) threshold = (1000 / this.detectedFps) * 0.75;
    if (settings.game.maxFps > 0) threshold = Math.max(threshold, 1000 / settings.game.maxFps - 0.4);
    if (this.menuOpen) threshold = Math.max(threshold, 1000 / 60 - 0.4);
    if (threshold > 0 && now - this.last < threshold) return;
    if ((settings.game.renderScale || 1) !== this.lastScale) this.resize();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (dt > 0) this.fps = this.fpsSampler.step(1 / dt);
    this.layers = this.scene.layers();
    for (const l of this.layers) l.world.step(dt);
    this.frameCamera();
    this.camera.update(dt, 1);
    if (this.visible) {
      const t0 = performance.now();
      this.draw(now);
      this.drawMs += (performance.now() - t0 - this.drawMs) * 0.1;
    }
  };

  private estimateRefresh() {
    const buf = this._rawDeltas;
    if (buf.length < 30) return;
    const votes = new Map<number, number>();
    for (let i = 1; i < buf.length; i++) {
      const d = buf[i];
      if (d < 2 || d > 100) continue;
      if (Math.abs(d - buf[i - 1]) > d * 0.25) continue;
      const hz = snapRefresh(1000 / d);
      votes.set(hz, (votes.get(hz) ?? 0) + 1);
    }
    let best = 0, bestN = 0;
    for (const [hz, n] of votes) {
      if (n > bestN) { best = hz; bestN = n; }
    }
    if (best > 0) this.detectedFps = best;
  }

  private frameCamera() {
    const t = this.scene.cameraTarget();
    if (!t) return;
    const base = (this.camera.viewportH / 1080) * 0.32 * this.userZoom;
    let scale: number;
    let maxView: number;
    if (settings.game.zoomMode === "manual") {
      scale = base;
      maxView = MAX_VIEW;
    } else {
      const r = Math.max(t.radius, 32);
      const zoom = Math.pow(Math.min(64 / r, 1), 0.4);
      scale = zoom * base;
      maxView = AUTO_MAX_VIEW;
    }
    const minScale = window.innerWidth / maxView;
    if (scale < minScale) scale = minScale;
    this.camera.focus(t.cx, t.cy, scale);
  }

  private draw(time: number) {
    const ctx = this.ctx;
    this.names.beginFrame();
    const W = this.canvas.width;
    const H = this.canvas.height;
    const theme = this.scene.themeFor();
    const border = this.scene.worldBorder();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = theme.backgroundColor || "#0c0c16";
    ctx.fillRect(0, 0, W, H);

    ctx.setTransform(
      this.camera.scale * this.dpr,
      0,
      0,
      this.camera.scale * this.dpr,
      W / 2 - this.camera.x * this.camera.scale * this.dpr,
      H / 2 - this.camera.y * this.camera.scale * this.dpr,
    );

    this.drawBackground(theme, border);
    if (theme.grid) this.drawGrid(border);
    this.drawBorder(theme, border, time);

    const halfW = W / (2 * this.camera.scale * this.dpr);
    const halfH = H / (2 * this.camera.scale * this.dpr);
    const vMinX = this.camera.x - halfW, vMaxX = this.camera.x + halfW;
    const vMinY = this.camera.y - halfH, vMaxY = this.camera.y + halfH;
    const minR = 2 / (this.camera.scale * this.dpr);

    const drawFood = theme.showPellets;

    const food = this._food; let foodN = 0;
    const viruses = this._viruses; let virusN = 0;
    const cellPool = this._cellPool; let cellN = 0;
    const cellMap = this._cellMap; cellMap.clear();
    const seen = this._seen; seen.clear();
    const prof = currentProfile();
    const layers = this.layers;
    for (let boxIdx = 0; boxIdx < layers.length; boxIdx++) {
      const layer = layers[boxIdx];
      const own = layer.world.ownIds;
      const sx = layer.world.scrambleX;
      const sy = layer.world.scrambleY;
      for (const n of layer.world.nodes.values()) {
        const x = n.rx - sx;
        const y = n.ry - sy;
        const r = Math.max(n.rsize, minR);
        let cullR = r;
        if (time - n.born < 2000 && Math.abs(n.born - layer.world.spawnFxAt) < 400 && own.has(n.id)) cullR = r * 31;
        if (x + cullR < vMinX || x - cullR > vMaxX || y + cullR < vMinY || y - cullR > vMaxY) continue;
        if (n.isVirus) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          let v = viruses[virusN];
          if (!v) v = viruses[virusN] = { n, x, y, r, outline: null, skin: "", mine: false, virus: true, fx: false };
          else { v.n = n; v.x = x; v.y = y; v.r = r; v.outline = null; v.skin = ""; v.mine = false; v.virus = true; v.fx = false; }
          virusN++;
        } else if (!n.name && n.rsize < 40) {
          if (!drawFood || seen.has(n.id)) continue;
          seen.add(n.id);
          let f = food[foodN];
          if (!f) f = food[foodN] = { n, x, y, r };
          else { f.n = n; f.x = x; f.y = y; f.r = r; }
          foodN++;
        } else {
          const mine = own.has(n.id);
          const prev = cellMap.get(n.id);
          if (prev && prev.mine && !mine) continue;
          const outline = mine ? (layer.active ? theme.activeOutline : theme.inactiveOutline) : null;
          let skin = "";
          if (mine && theme.customSkins) skin = prof.skins[boxIdx] || prof.skins.find((s) => !!s) || "";
          if (!skin && !mine && n.name) skin = this.scene.sharedSkin(n.name);
          if (!skin && theme.gameSkins && n.skinUrl) skin = n.skinUrl;
          const fx = mine && Math.abs(n.born - layer.world.spawnFxAt) < 400 && time - n.born < 2000;
          if (prev) {
            prev.n = n; prev.x = x; prev.y = y; prev.r = r; prev.outline = outline; prev.skin = skin; prev.mine = mine; prev.fx = fx;
          } else {
            let c = cellPool[cellN];
            if (!c) c = cellPool[cellN] = { n, x, y, r, outline, skin, mine, virus: false, fx };
            else { c.n = n; c.x = x; c.y = y; c.r = r; c.outline = outline; c.skin = skin; c.mine = mine; c.virus = false; c.fx = fx; }
            cellN++;
            cellMap.set(n.id, c);
          }
        }
      }
    }

    const cells = this._cells; let cn = 0;
    for (const c of cellMap.values()) cells[cn++] = c;
    for (let i = 0; i < virusN; i++) cells[cn++] = viruses[i];
    cells.length = cn;
    cells.sort((a, b) => a.r - b.r);
    if (foodN > MAX_FOOD) { food.length = foodN; food.sort((a, b) => b.r - a.r); foodN = MAX_FOOD; }
    this.dbgCells = Math.min(cn, MAX_CELLS);
    this.dbgFood = foodN;
    let nn = 0; for (let i = 0; i < layers.length; i++) nn += layers[i].world.nodes.size;
    this.dbgNodes = nn;
    const pellet = theme.pelletColor;
    const foodR = 14 * this.camera.scale * this.dpr;
    if (pellet) {
      ctx.beginPath();
      for (let i = 0; i < foodN; i++) {
        const f = food[i];
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = pellet;
      ctx.fill();
    } else if (foodR < 6) {
      const buckets = this._foodBuckets;
      for (let i = 0; i < buckets.length; i++) buckets[i].length = 0;
      for (let i = 0; i < foodN; i++) {
        const f = food[i];
        const key = ((f.n.r >> 6) << 4) | ((f.n.g >> 6) << 2) | (f.n.b >> 6);
        buckets[key].push(f);
      }
      for (let k = 0; k < buckets.length; k++) {
        const b = buckets[k];
        if (!b.length) continue;
        ctx.beginPath();
        for (let i = 0; i < b.length; i++) {
          const f = b[i];
          ctx.moveTo(f.x + f.r, f.y);
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        }
        ctx.fillStyle = FOOD_BUCKET_COLORS[k];
        ctx.fill();
      }
    } else {
      for (let i = 0; i < foodN; i++) { const f = food[i]; this.drawDisc(f.n, f.x, f.y, f.r, ""); }
    }
    const start = Math.max(0, cells.length - MAX_CELLS);
    const cscale = this.camera.scale;
    let flatCount = 0;
    for (let i = start; i < cells.length; i++) { const c = cells[i]; if (!c.virus && !c.outline && !c.skin) flatCount++; }
    const flatToBatch = Math.max(0, flatCount - FULL_BUDGET);
    const cbuckets = this._cellBuckets;
    for (let k = 0; k < cbuckets.length; k++) cbuckets[k].length = 0;
    let flatSeen = 0, batched = false;
    for (let i = start; i < cells.length; i++) {
      const c = cells[i];
      if (c.virus || c.outline || c.skin) continue;
      const dot = c.r * cscale <= 6 || flatSeen < flatToBatch;
      flatSeen++;
      if (!dot) continue;
      cbuckets[((c.n.r >> 6) << 4) | ((c.n.g >> 6) << 2) | (c.n.b >> 6)].push(c);
      batched = true;
    }
    if (batched) {
      for (let k = 0; k < cbuckets.length; k++) {
        const b = cbuckets[k];
        if (!b.length) continue;
        ctx.beginPath();
        for (let i = 0; i < b.length; i++) { const c = b[i]; ctx.moveTo(c.x + c.r, c.y); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); }
        ctx.fillStyle = FOOD_BUCKET_COLORS[k];
        ctx.fill();
      }
    }
    flatSeen = 0;
    for (let i = start; i < cells.length; i++) {
      const c = cells[i];
      if (!c.virus && !c.outline && !c.skin) {
        const dot = c.r * cscale <= 6 || flatSeen < flatToBatch;
        flatSeen++;
        if (dot) continue;
      }
      if (c.virus) this.drawVirus(c.n, c.x, c.y, c.r);
      else this.drawCell(c.n, c.x, c.y, c.r, c.outline, c.skin, theme, time, c.fx);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (theme.minimap) this.drawMinimap(border, layers, time);
  }

  private drawBackground(theme: SceneTheme, b: Border) {
    if (!theme.backgroundUrl) return;
    const img = this.images.get(theme.backgroundUrl);
    if (!img) return;
    this.ctx.globalAlpha = 0.5;
    this.ctx.drawImage(img, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    this.ctx.globalAlpha = 1;
  }

  private drawGrid(b: Border) {
    const ctx = this.ctx;
    const step = 250;
    const halfW = this.canvas.width / (2 * this.camera.scale * this.dpr) + step;
    const halfH = this.canvas.height / (2 * this.camera.scale * this.dpr) + step;
    const x0 = Math.max(b.minX, Math.floor((this.camera.x - halfW) / step) * step);
    const x1 = Math.min(b.maxX, this.camera.x + halfW);
    const y0 = Math.max(b.minY, Math.floor((this.camera.y - halfH) / step) * step);
    const y1 = Math.min(b.maxY, this.camera.y + halfH);
    ctx.lineWidth = 1 / this.camera.scale;
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
  }

  private drawBorder(theme: SceneTheme, b: Border, time: number) {
    const ctx = this.ctx;
    ctx.lineWidth = 10 / this.camera.scale;
    ctx.strokeStyle = theme.animatedBorder
      ? `hsl(${(time / 30) % 360}, 70%, 55%)`
      : "rgba(255,80,80,0.55)";
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  }

  private drawDisc(n: RNode, x: number, y: number, r: number, pelletColor: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = pelletColor || n.css;
    ctx.fill();
  }

  private drawCell(n: RNode, x: number, y: number, r: number, outline: string | null, skin: string, theme: SceneTheme, time: number, fx: boolean) {
    const ctx = this.ctx;
    const rpx = r * this.camera.scale;
    if (theme.spawnEffects && fx && rpx > 3) {
      const age = time - n.born;
      if (age >= 0 && age < 1800) {
        const t01 = age / 1800;
        const color = outline ?? "#67e8f9";
        ctx.beginPath();
        ctx.arc(x, y, r * (1 + 30 * t01), 0, Math.PI * 2);
        ctx.lineWidth = Math.max(16 / this.camera.scale, r * 0.6) * (1 - t01) + 0.001;
        ctx.globalAlpha = 0.9 * (1 - t01);
        ctx.strokeStyle = color;
        ctx.stroke();
        const t2 = Math.max(0, t01 - 0.15);
        ctx.beginPath();
        ctx.arc(x, y, r * (1 + 20 * t2), 0, Math.PI * 2);
        ctx.lineWidth = Math.max(8 / this.camera.scale, r * 0.25) * (1 - t2) + 0.001;
        ctx.globalAlpha = 0.6 * (1 - t2);
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (theme.shadows && rpx > 16) {
      ctx.beginPath();
      ctx.arc(x, y + r * 0.06, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = n.css;
    ctx.fill();

    const img = skin ? this.images.get(skin) : null;
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }

    if (outline || rpx > 6) {
      ctx.lineWidth = (outline ? 6 * theme.ringSize : 3) / this.camera.scale;
      ctx.strokeStyle = outline ?? "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (rpx > 22) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (theme.names && n.name && rpx > 30) {
        const bmp = this.names.get(n.name);
        if (bmp) {
          const gh = Math.max(11, r * 0.32);
          const fullH = gh * bmp.hScale, fullW = fullH * bmp.aspect;
          ctx.drawImage(bmp.canvas, x - fullW / 2, y - r * 0.12 - fullH / 2, fullW, fullH);
        }
      }
      if (theme.mass) {
        ctx.font = `${Math.max(9, r * 0.26)}px system-ui, sans-serif`;
        ctx.fillText(n.massStr, x, y + r * 0.22);
      }
    }
  }

  private drawVirus(n: RNode, x: number, y: number, r: number) {
    const ctx = this.ctx;
    const spikes = 28;
    const outer = r;
    const inner = r * 0.9;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI * i) / spikes;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = n.r || n.g || n.b ? n.css : "rgba(45,200,90,0.95)";
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.strokeStyle = "rgba(20,120,50,1)";
    ctx.stroke();
  }

  private _miniCanvas: HTMLCanvasElement | null = null;
  private _miniCtx: CanvasRenderingContext2D | null = null;
  private _miniAt = 0;
  private _miniSize = 0;

  private drawMinimap(b: Border, layers: SceneLayer[], time: number) {
    const ctx = this.ctx;
    const size = Math.round(150 * this.dpr);
    const pad = 12 * this.dpr;
    const x0 = this.canvas.width - size - pad;
    const y0 = this.canvas.height - size - pad;
    const W = b.maxX - b.minX || 1;
    const H = b.maxY - b.minY || 1;

    if (!this._miniCanvas || this._miniSize !== size) {
      const c = this._miniCanvas ?? (this._miniCanvas = document.createElement("canvas"));
      c.width = c.height = size;
      this._miniCtx = c.getContext("2d");
      this._miniSize = size;
      this._miniAt = 0;
    }
    const mctx = this._miniCtx!;

    if (time - this._miniAt > 120) {
      this._miniAt = time;
      mctx.clearRect(0, 0, size, size);
      mctx.fillStyle = "rgba(0,0,0,0.35)";
      mctx.fillRect(0, 0, size, size);
      mctx.strokeStyle = "rgba(255,255,255,0.15)";
      mctx.lineWidth = 1;
      mctx.strokeRect(0.5, 0.5, size - 1, size - 1);
      mctx.fillStyle = "rgba(255,255,255,0.35)";
      for (const layer of layers) {
        const own = layer.world.ownIds;
        const scrX = layer.world.scrambleX, scrY = layer.world.scrambleY;
        for (const n of layer.world.nodes.values()) {
          if (n.isVirus || (!n.name && n.rsize < 40) || own.has(n.id)) continue;
          const px = ((n.rx - scrX - b.minX) / W) * size;
          const py = ((n.ry - scrY - b.minY) / H) * size;
          mctx.fillRect(px - 1, py - 1, 2, 2);
        }
      }
    }
    ctx.drawImage(this._miniCanvas!, x0, y0);

    const sx = (wx: number) => x0 + ((wx - b.minX) / W) * size;
    const sy = (wy: number) => y0 + ((wy - b.minY) / H) * size;
    const theme = this.scene.themeFor();
    for (const layer of layers) {
      const own = layer.world.ownIds;
      const scrX = layer.world.scrambleX, scrY = layer.world.scrambleY;
      ctx.fillStyle = layer.active ? theme.activeOutline : theme.inactiveOutline;
      for (const id of own) {
        const n = layer.world.nodes.get(id);
        if (!n) continue;
        ctx.beginPath();
        ctx.arc(sx(n.rx - scrX), sy(n.ry - scrY), 3 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const halfW = this.canvas.width / (2 * this.camera.scale * this.dpr);
    const halfH = this.canvas.height / (2 * this.camera.scale * this.dpr);
    const vx0 = Math.max(x0, sx(this.camera.x - halfW));
    const vy0 = Math.max(y0, sy(this.camera.y - halfH));
    const vx1 = Math.min(x0 + size, sx(this.camera.x + halfW));
    const vy1 = Math.min(y0 + size, sy(this.camera.y + halfH));
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.strokeRect(vx0, vy0, Math.max(2, vx1 - vx0), Math.max(2, vy1 - vy0));
  }
}
