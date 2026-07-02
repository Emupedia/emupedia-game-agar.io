import type { ChatLog } from "./chat";
import { SocketClient } from "./client";
import {
  encodeChat,
  encodeMove,
  encodeOgarSpawn,
  type MoveFormat,
} from "./encode";
import type { GameLink, HookStats } from "./hook";
import type { Overlay, Scene, SceneLayer, SceneTheme } from "./overlay";
import { currentProfile, settings } from "./settings";
import type { SkinShare } from "./skinshare";
import { World } from "./world";

interface Player {
  world: World;
  client: SocketClient | null;
  deployed: boolean;
}

const CHIP_COLORS = ["#22d3ee", "#fbbf24"];

export type GameMode = "menu" | "playing" | "spectating";

const MACRO_FEED_MS = 70;
const SPECTATE_OP = 15;
const ENABLE_SECOND_SOCKET = true;
const RELAY_URL = "";
const WS2_URL = `wss://agar.${location.host}/ws2/`;
const PROTOCOL_VERSION = 6;
const HANDSHAKE_KEY = 1;
const SHARE_SKINS_VIA_CHAT = false;

export class Multibox implements Scene {
  private players: Player[];
  private active = 0;
  private overlay: Overlay | null = null;
  private moveFmt: MoveFormat = "i32";
  private mouseX = 0;
  private mouseY = 0;
  private aim: ({ x: number; y: number } | null)[] = [];
  private aliveState: boolean[] = [];
  private tickN = 0;
  private connecting = false;
  private spectateWorld: World;
  private macroFeedHeld = false;
  private lastFeed = 0;
  private lastAnnounce = 0;
  private chatNick = "";
  private lastSpecKick = 0;
  private spectateKicked = false;
  private pendingRespawn: number | null = null;
  private respawnStart = 0;
  paused = false;
  mode: GameMode = "menu";
  fps = 0;

  private ws1Cut = false;
  private recentChat = new Map<string, number>();
  private auxClient: SocketClient | null = null;

  constructor(
    gameWorld: World,
    private link: GameLink,
    private stats: HookStats,
    private log: (...a: unknown[]) => void,
    private skinShare: SkinShare,
    private chat: ChatLog,
  ) {
    void gameWorld;
    this.spectateWorld = new World();
    this.players = [
      { world: new World(), client: null, deployed: false },
      { world: new World(), client: null, deployed: false },
    ];
    window.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    this.link.suppressMove = true;
    this.link.suppressSpawn = true;
    this.link.suppressAction = false;
    this.chatNick = this.nick();
    setInterval(() => this.tick(), 1000 / 33);
    setInterval(() => this.autoConnect(), 800);
    setInterval(() => this.announceSkin(), 15_000);
  }

  attachOverlay(o: Overlay) {
    this.overlay = o;
  }

  private build254(): ArrayBuffer {
    return new Uint8Array([254, PROTOCOL_VERSION, 0, 0, 0]).buffer;
  }

  private build255(): ArrayBuffer {
    const name = new TextEncoder().encode(this.nick());
    const out = new ArrayBuffer(5 + name.length);
    const ov = new DataView(out);
    ov.setUint8(0, 255);
    ov.setUint32(1, HANDSHAKE_KEY, true);
    new Uint8Array(out).set(name, 5);
    return out;
  }

  private autoConnect() {
    if (this.connecting) return;
    const p254 = this.build254();
    const p255 = this.build255();
    const auxRs = this.auxClient?.ws?.readyState;
    if (auxRs !== WebSocket.OPEN && auxRs !== WebSocket.CONNECTING) {
      this.connecting = true;
      void this.connectAux(p254, p255).finally(() => (this.connecting = false));
      return;
    }
    const last = ENABLE_SECOND_SOCKET ? this.players.length : 1;
    for (let i = 0; i < last; i++) {
      const rs = this.players[i].client?.ws?.readyState;
      if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) continue;
      this.connecting = true;
      void this.connectBox(i, p254, p255).finally(() => (this.connecting = false));
      return;
    }
  }

  private async connectAux(p254: ArrayBuffer, p255: ArrayBuffer) {
    const url = RELAY_URL || WS2_URL;
    const aux = new SocketClient("AUX", url, [p254, p255], this.log,
      (name, message, color) => this.ingestChat(name, message, color));
    aux.worldEnabled = false;
    this.auxClient = aux;
    this.spectateWorld = aux.world;
    await aux.connect();
    this.log("[agar-ext] aux (chat/spectate) socket connecting");
  }

  private async connectBox(idx: number, p254: ArrayBuffer, p255: ArrayBuffer) {
    const url = RELAY_URL || WS2_URL;
    const client = new SocketClient(`P${idx + 1}`, url, [p254, p255], this.log);
    client.worldEnabled = false;
    this.players[idx] = { world: client.world, client, deployed: false };
    await client.connect();
    this.log(`[agar-ext] box ${idx + 1} socket connecting (handshake only - Play/TAB to deploy)`);
  }

  private ingestChat(name: string, message: string, color: string) {
    if (this.skinShare.ingest(message)) return;
    if (/antispam/i.test(message)) return;
    const now = performance.now();
    const k = name + " " + message;
    const seen = this.recentChat.get(k);
    if (seen !== undefined && now - seen < 5000) return;
    this.recentChat.set(k, now);
    if (this.recentChat.size > 128) for (const [kk, t] of this.recentChat) if (now - t > 8000) this.recentChat.delete(kk);
    this.chat.add(name, message, color);
  }

  private nick(): string {
    return (currentProfile().name || "An unnamed cell").slice(0, 15);
  }

  private alive(p: Player): boolean {
    for (const id of p.world.ownIds) if (p.world.nodes.has(id)) return true;
    return false;
  }

  play() {
    this.mode = "playing";
    this.paused = false;
    this.active = 0;
    this.syncChatNick();
    if (this.players[0].client?.open) {
      this.spawnBox(0);
    } else {
      this.pendingRespawn = 0;
      this.respawnStart = performance.now();
      this.log("[agar-ext] Play: box 1 socket still connecting - will spawn when ready");
    }
  }

  respawn() {
    const mass = this.activeMass();
    if (mass > 500) {
      this.log(`[agar-ext] quick respawn blocked - box mass ${Math.round(mass)} > 500 (too big to risk)`);
      return;
    }
    this.mode = "playing";
    this.paused = false;
    this.leaveAndRejoin(this.active);
  }

  private activeMass(): number {
    const p = this.players[this.active];
    if (!p) return 0;
    let m = 0;
    for (const id of p.world.ownIds) { const n = p.world.nodes.get(id); if (n) m += n.dispMass; }
    return m;
  }

  private leaveAndRejoin(idx: number) {
    const p = this.players[idx];
    if (!p?.client) { this.log(`[agar-ext] quick respawn box ${idx + 1}: not connected yet`); return; }
    this.pendingRespawn = idx;
    this.respawnStart = performance.now();
    this.log(`[agar-ext] quick respawn box ${idx + 1}: leaving server...`);
    p.client.reconnect();
  }

  private spawnPending() {
    if (this.pendingRespawn === null) return;
    const idx = this.pendingRespawn;
    const p = this.players[idx];
    const elapsed = performance.now() - this.respawnStart;
    if (p?.client?.open && elapsed > 250) {
      this.pendingRespawn = null;
      this.active = idx;
      this.spawnBox(idx);
      this.overlay?.snapCamera();
      this.log(`[agar-ext] quick respawn box ${idx + 1}: rejoined -> spawned`);
    } else if (elapsed > 9000) {
      this.pendingRespawn = null;
      this.log(`[agar-ext] quick respawn box ${idx + 1}: timed out waiting to reconnect`);
    }
  }

  private gameSettings(): Record<string, unknown> {
    try { return JSON.parse(localStorage.getItem("settings") || "{}"); } catch { return {}; }
  }

  private setGameNick(name: string): boolean {
    let changed = false;
    try {
      const s = this.gameSettings();
      if (s.nick !== name) { s.nick = name; localStorage.setItem("settings", JSON.stringify(s)); changed = true; }
    } catch {}
    try {
      const input = document.querySelector<HTMLInputElement>("#nick");
      if (input && input.value !== name) input.value = name;
    } catch {}
    return changed;
  }

  private syncChatNick() {
    const want = this.nick();
    this.setGameNick(want);
    if (want !== this.chatNick) {
      this.chatNick = want;
      const aux = this.auxClient;
      if (aux) { aux.setHandshake([this.build254(), this.build255()]); aux.reconnect(); }
      this.log(`[agar-ext] chat nick -> "${want}"`);
    }
  }

  refreshChatNick() { this.syncChatNick(); }

  private buildSpawn(nick: string): ArrayBuffer | null {
    const s = this.gameSettings();
    const fp2 = typeof s.fp2 === "string" ? (s.fp2 as string) : "";
    if (!fp2) return null;
    const col = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "#ffffff");
    return encodeOgarSpawn(nick, fp2, col("cellColor"), col("nameColor"), col("borderColor"));
  }

  private spawnBox(idx: number) {
    const p = this.players[idx];
    if (!p) return;
    const nick = this.nick();
    const pkt = this.buildSpawn(nick);
    if (!pkt) {
      this.log("[agar-ext] no fp2 in localStorage['settings'] - cannot spawn");
      return;
    }
    if (!p.client) { this.log(`[agar-ext] box ${idx + 1} not connected yet - cannot spawn`); return; }
    p.client.worldEnabled = true;
    p.client.send(pkt);
    p.deployed = true;
    this.announceSkin();
    this.log(`[agar-ext] opcode-20 spawn box ${idx + 1} (nick="${nick}")`);
  }

  spectate() {
    if (this.mode === "spectating") {
      this.mode = "playing";
      this.log("[agar-ext] spectate off -> back to your boxes");
    } else {
      this.mode = "spectating";
      this.paused = false;
      this.log("[agar-ext] spectate (aux socket) - follow top player");
    }
  }

  private manageSpectate(now: number) {
    const aux = this.auxClient;
    if (!aux || aux.ws?.readyState !== WebSocket.OPEN) return;
    const wantStream = this.mode === "spectating" || settings.game.spectatorView;
    if (wantStream) {
      if (!aux.worldEnabled) aux.worldEnabled = true;
      if (!this.spectateKicked || (aux.world.nodes.size === 0 && now - this.lastSpecKick > 3000)) {
        this.spectateKicked = true;
        this.lastSpecKick = now;
        aux.send(this.oneByte(SPECTATE_OP));
        window.setTimeout(() => {
          if ((this.mode === "spectating" || settings.game.spectatorView) && aux.ws?.readyState === WebSocket.OPEN) {
            aux.send(this.oneByte(SPECTATE_OP));
          }
        }, 300);
        this.log("[agar-ext] spectate: requesting aux stream (follow-leader)");
      }
    } else if (aux.worldEnabled) {
      aux.worldEnabled = false;
      aux.world.clear();
      this.spectateKicked = false;
    }
  }

  private cutWs1() {
    if (this.ws1Cut) return;
    this.ws1Cut = true;
    this.link.blocked = true;
    try { this.link.ws?.close(); } catch {}
    this.log("[agar-ext] WS1 (game socket) CUT - chat now on our sockets; game does no more WS work (fixes freezes)");
  }

  switchActive() {
    if (!ENABLE_SECOND_SOCKET) {
      this.log("[agar-ext] single-socket mode - box 2 disabled");
      return;
    }
    const n = this.players.length;
    let next = -1;
    for (let i = 1; i <= n; i++) {
      const idx = (this.active + i) % n;
      if (this.controllable(this.players[idx])) { next = idx; break; }
    }
    if (next < 0) {
      this.log("[agar-ext] no other box connected yet");
      return;
    }
    this.active = next;
    const p = this.players[next];
    if (!this.alive(p)) this.spawnBox(next);
    if (settings.game.multiboxCamera === "single") this.overlay?.snapCamera();
    this.log(`[agar-ext] active -> box ${this.active + 1}`);
  }

  private sendTo(p: Player, buf: ArrayBuffer) {
    p.client?.send(buf);
  }
  private sendActive(buf: ArrayBuffer) {
    this.sendTo(this.players[this.active], buf);
  }

  private oneByte(op: number): ArrayBuffer { return new Uint8Array([op]).buffer; }
  private warnedOps = false;
  split() {
    const op = settings.game.splitOp;
    if (op > 0) this.sendActive(this.oneByte(op));
    else this.warnOps();
  }
  eject() {
    const op = settings.game.ejectOp;
    if (op > 0) this.sendActive(this.oneByte(op));
    else this.warnOps();
  }
  private warnOps() {
    if (this.warnedOps) return;
    this.warnedOps = true;
    this.log("[agar-ext] split/eject opcode not set - Settings -> Controls (or read it from the packet log)");
  }
  private macroSplit(times: number) {
    const op = settings.game.splitOp;
    if (op <= 0) { this.warnOps(); return; }
    const box = this.active;
    const p = this.players[box];
    const aim = this.aim[box];
    this.log(`[agar-ext] macro split x${times} on box ${box + 1} (op ${op})`);
    for (let i = 0; i < times; i++) {
      window.setTimeout(() => {
        if (!this.controllable(p)) return;
        if (aim) this.sendTo(p, encodeMove(aim.x, aim.y, this.moveFmt));
        this.sendTo(p, this.oneByte(op));
      }, i * 60);
    }
  }
  doubleSplit() { this.macroSplit(2); }
  split16() { this.macroSplit(4); }
  setMacroFeed(held: boolean) {
    this.macroFeedHeld = held;
    if (held) { this.lastFeed = 0; this.eject(); }
  }
  togglePause() { this.paused = !this.paused; }

  sendChat(text: string) {
    const msg = text.trim().slice(0, 200);
    if (!msg) return;
    const op = settings.game.chatOp;
    if (op <= 0) { this.log("[agar-ext] chat opcode not set (Settings -> Controls)"); return; }
    const me = this.nick();
    this.recentChat.set(me + " " + msg, performance.now());
    this.chat.add(me, msg, "#67e8f9");
    const buf = encodeChat(msg, op);
    if (this.auxClient?.ws?.readyState === WebSocket.OPEN) {
      this.auxClient.send(buf); this.log(`[agar-ext] chat -> "${msg}" (op ${op}, aux)`);
      return;
    }
    const p = this.players.find((pl) => pl.client?.ws?.readyState === WebSocket.OPEN);
    if (p) { p.client!.send(buf); this.log(`[agar-ext] chat -> "${msg}" (op ${op}, box)`); }
    else { this.link.sendRaw?.(buf); this.log(`[agar-ext] chat -> "${msg}" (op ${op}, WS1 - aux not up yet)`); }
  }

  private announceSkin() {
    if (!SHARE_SKINS_VIA_CHAT) return;
    if (!settings.theme.customSkins || this.mode !== "playing") return;
    const url = (currentProfile().skins.find((s) => !!s) || "").trim();
    if (!url) return;
    const op = settings.game.chatOp;
    if (op <= 0 || !this.link.sendRaw) return;
    const now = performance.now();
    if (now - this.lastAnnounce < 7000) return;
    this.lastAnnounce = now;
    this.link.sendRaw(encodeChat(this.skinShare.encode(this.nick(), url), op));
  }

  sharedSkin(name: string): string {
    if (this.skinShare.size === 0 || !name) return "";
    return this.skinShare.get(name);
  }

  private controllable(p: Player): boolean {
    return p.client?.ws?.readyState === WebSocket.OPEN;
  }
  running(): boolean {
    return this.mode !== "menu";
  }

  private _layers: SceneLayer[] = [];
  layers(): SceneLayer[] {
    const ls = this._layers;
    let n = 0;
    for (let i = 0; i < this.players.length; i++) {
      let e = ls[n];
      if (!e) e = ls[n] = { world: this.players[i].world, active: i === this.active };
      else { e.world = this.players[i].world; e.active = i === this.active; }
      n++;
    }
    if (this.auxClient?.worldEnabled) {
      let e = ls[n];
      if (!e) e = ls[n] = { world: this.spectateWorld, active: false };
      else { e.world = this.spectateWorld; e.active = false; }
      n++;
    }
    ls.length = n;
    return ls;
  }
  private _theme = {} as SceneTheme;
  themeFor(): SceneTheme {
    const t = settings.theme;
    const o = this._theme;
    o.grid = t.showGrid; o.names = t.showNames; o.mass = t.showMass; o.minimap = t.showMinimap;
    o.shadows = t.cellShadow; o.customSkins = t.customSkins; o.gameSkins = t.gameSkins;
    o.massFormat = t.massFormat; o.ringSize = t.ringSize;
    o.pelletColor = t.pelletColor; o.showPellets = t.showPellets;
    o.animatedBorder = t.animatedBorder; o.spawnEffects = t.spawnEffects;
    o.backgroundUrl = t.backgroundUrl; o.activeOutline = t.activeOutline; o.inactiveOutline = t.inactiveOutline;
    return o;
  }

  private realOwnCenter(p: Player) {
    const c = p.world.ownCenter();
    if (!c) return null;
    return { cx: c.cx - p.world.scrambleX, cy: c.cy - p.world.scrambleY, radius: c.radius };
  }

  cameraTarget() {
    if (this.paused) return null;
    if (this.mode === "spectating") {
      return this.biggestInWorld(this.spectateWorld);
    }
    if (settings.game.multiboxCamera === "center") {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, has = false;
      for (const p of this.players) {
        for (const id of p.world.ownIds) {
          const n = p.world.nodes.get(id);
          if (!n) continue;
          has = true;
          const rx = n.rx - p.world.scrambleX, ry = n.ry - p.world.scrambleY;
          minX = Math.min(minX, rx - n.rsize); minY = Math.min(minY, ry - n.rsize);
          maxX = Math.max(maxX, rx + n.rsize); maxY = Math.max(maxY, ry + n.rsize);
        }
      }
      if (has) return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, radius: Math.max((maxX - minX) / 2, (maxY - minY) / 2) };
    }
    return this.realOwnCenter(this.players[this.active]) ?? this.realOwnCenter(this.players[0]) ?? this.biggestCellReal();
  }

  worldBorder() {
    const w = this.players[this.active].world;
    return {
      minX: w.border.minX - w.scrambleX, minY: w.border.minY - w.scrambleY,
      maxX: w.border.maxX - w.scrambleX, maxY: w.border.maxY - w.scrambleY,
    };
  }

  leaderboard() {
    const b1 = this.players[0].world.leaderboard;
    return b1.length ? b1 : this.spectateWorld.leaderboard;
  }

  private biggestInWorld(w: World) {
    let best: { cx: number; cy: number; radius: number } | null = null;
    for (const n of w.nodes.values()) {
      if (n.isVirus || (!n.name && n.rsize < 40)) continue;
      if (!best || n.rsize > best.radius) best = { cx: n.rx - w.scrambleX, cy: n.ry - w.scrambleY, radius: n.rsize };
    }
    return best;
  }

  private biggestCellReal() {
    let best: { cx: number; cy: number; radius: number } | null = null;
    const worlds = this.players.map((p) => p.world);
    if (this.mode === "spectating") worlds.push(this.spectateWorld);
    for (const w of worlds) {
      for (const n of w.nodes.values()) {
        if (n.isVirus || (!n.name && n.rsize < 40)) continue;
        if (!best || n.rsize > best.radius) best = { cx: n.rx - w.scrambleX, cy: n.ry - w.scrambleY, radius: n.rsize };
      }
    }
    return best;
  }

  private pingMs(): number {
    const a = this.players[this.active]?.client;
    if (a && a.ws?.readyState === WebSocket.OPEN && a.ping > 0) return a.ping;
    const aux = this.auxClient;
    if (aux && aux.ws?.readyState === WebSocket.OPEN && aux.ping > 0) return aux.ping;
    return 0;
  }

  hud() {
    let cellCount = 0;
    const players = this.players.map((p, i) => {
      let mass = 0, cells = 0;
      for (const id of p.world.ownIds) {
        const n = p.world.nodes.get(id);
        if (n) { mass += n.dispMass; cells++; }
      }
      cellCount += cells;
      return {
        label: `${i + 1}`,
        alive: cells > 0,
        connected: this.controllable(p),
        active: i === this.active,
        mass: Math.round(mass),
        color: CHIP_COLORS[i % CHIP_COLORS.length],
      };
    });
    return {
      active: this.active,
      boxCount: this.players.length,
      cellCount,
      mass: players[this.active]?.mass ?? 0,
      ping: this.pingMs(),
      players,
    };
  }

  get status(): string {
    const auxRs = this.auxClient?.ws?.readyState;
    const aux = auxRs === WebSocket.OPEN ? "open" : auxRs === WebSocket.CONNECTING ? "conn" : "down";
    const boxes = this.players
      .map((p, i) => {
        const r = p.client?.ws?.readyState;
        const rs = r === WebSocket.OPEN ? "open" : r === WebSocket.CONNECTING ? "conn" : "closed";
        const cells = [...p.world.ownIds].filter((id) => p.world.nodes.has(id)).length;
        return `${i === this.active ? ">" : " "}${i + 1}:${rs}(${cells})`;
      })
      .join("  ");
    return `aux(chat/spec):${aux}  ${boxes}`;
  }

  private tick() {
    if (!this.overlay) return;
    if (!this.ws1Cut && this.auxClient?.ws?.readyState === WebSocket.OPEN) {
      this.cutWs1();
    }
    this.spawnPending();
    this.manageSpectate(performance.now());
    if (!this.controllable(this.players[this.active])) this.active = 0;

    for (let i = 0; i < this.players.length; i++) {
      const al = this.alive(this.players[i]);
      if (this.aliveState[i] && !al && i === this.active && i !== this.pendingRespawn) {
        const j = this.players.findIndex((p, k) => k !== i && this.controllable(p) && this.alive(p));
        if (j >= 0) { this.active = j; this.overlay.snapCamera(); this.log(`[agar-ext] box ${i + 1} died -> switch to box ${j + 1}`); }
      }
      this.aliveState[i] = al;
    }

    const now = performance.now();
    if (this.macroFeedHeld && this.mode === "playing" && !this.paused && now - this.lastFeed > MACRO_FEED_MS) {
      this.lastFeed = now;
      this.eject();
    }

    if (this.paused || this.mode === "spectating") return;

    this.tickN++;
    const cursor = this.overlay.screenToWorld(this.mouseX, this.mouseY);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!this.controllable(p)) continue;
      if (i !== this.active && this.tickN % 4 !== 0) continue;
      let tx: number, ty: number;
      if (i === this.active) {
        tx = cursor.x + p.world.scrambleX;
        ty = cursor.y + p.world.scrambleY;
        this.aim[i] = { x: tx, y: ty };
      } else if (settings.game.inactiveBoxStops) {
        const c = p.world.ownCenter();
        if (!c) continue;
        tx = c.cx; ty = c.cy;
      } else {
        const a = this.aim[i] ?? (p.world.ownCenter() && { x: p.world.ownCenter()!.cx, y: p.world.ownCenter()!.cy });
        if (!a) continue;
        tx = a.x; ty = a.y;
      }
      this.sendTo(p, encodeMove(tx, ty, this.moveFmt));
    }
  }
}
