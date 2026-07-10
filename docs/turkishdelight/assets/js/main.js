"use strict";
(() => {
  // src/chat.ts
  var ChatLog = class {
    constructor() {
      this.msgs = [];
      this.rev = 0;
    }
    add(name, message, color) {
      this.msgs.push({ name, message, color, t: Date.now() });
      if (this.msgs.length > 100) this.msgs.shift();
      this.rev++;
    }
  };

  // src/fp2.ts
  var LEGACY_SETTINGS_KEY = "settings";
  var FP2_KEY = "agarv2mod-fp2";
  var cached = null;
  async function sha256Hex(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function generateFp2() {
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      (/* @__PURE__ */ new Date()).getTimezoneOffset(),
      crypto.randomUUID()
    ].join("|");
    return sha256Hex(data);
  }
  function readLegacyFp2() {
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY) || "{}");
      if (typeof legacy.fp2 === "string" && legacy.fp2.length >= 64) return legacy.fp2;
    } catch {
    }
    return "";
  }
  function getFp2Sync() {
    return cached != null ? cached : "";
  }
  async function ensureFp2() {
    if (cached) return cached;
    const legacy = readLegacyFp2();
    if (legacy) {
      cached = legacy;
      return cached;
    }
    try {
      const stored = localStorage.getItem(FP2_KEY);
      if (stored && stored.length >= 64) {
        cached = stored;
        return cached;
      }
    } catch {
    }
    cached = await generateFp2();
    try {
      localStorage.setItem(FP2_KEY, cached);
    } catch {
    }
    return cached;
  }
  function hslToHex(h, s, l) {
    const hh = (h % 360 + 360) % 360 / 360;
    const ss = s / 100;
    const ll = l / 100;
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    let r, g, b;
    if (ss === 0) {
      r = g = b = ll;
    } else {
      const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
      const p = 2 * ll - q;
      r = hue2rgb(p, q, hh + 1 / 3);
      g = hue2rgb(p, q, hh);
      b = hue2rgb(p, q, hh - 1 / 3);
    }
    const toByte = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
    return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
  }
  function profileColors(hue) {
    return {
      cellColor: hslToHex(hue, 70, 55),
      nameColor: hslToHex(hue, 60, 75),
      borderColor: hslToHex(hue, 80, 40)
    };
  }

  // src/protocol.ts
  var COORD = "i32";
  var Reader = class {
    constructor(buf) {
      this.off = 0;
      this.view = new DataView(buf);
    }
    get remaining() {
      return this.view.byteLength - this.off;
    }
    u8() {
      const v = this.view.getUint8(this.off);
      this.off += 1;
      return v;
    }
    u16() {
      const v = this.view.getUint16(this.off, true);
      this.off += 2;
      return v;
    }
    i16() {
      const v = this.view.getInt16(this.off, true);
      this.off += 2;
      return v;
    }
    u32() {
      const v = this.view.getUint32(this.off, true);
      this.off += 4;
      return v;
    }
    i32() {
      const v = this.view.getInt32(this.off, true);
      this.off += 4;
      return v;
    }
    f32() {
      const v = this.view.getFloat32(this.off, true);
      this.off += 4;
      return v;
    }
    f64() {
      const v = this.view.getFloat64(this.off, true);
      this.off += 8;
      return v;
    }
    coord() {
      return COORD === "i16" ? this.i16() : this.i32();
    }
    str8() {
      const bytes = [];
      for (; ; ) {
        if (this.remaining < 1) break;
        const c = this.u8();
        if (c === 0) break;
        bytes.push(c);
      }
      return decodeUtf8(bytes);
    }
    str16() {
      let s = "";
      for (; ; ) {
        if (this.remaining < 2) break;
        const c = this.u16();
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s;
    }
  };
  var UTF8 = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
  function decodeUtf8(bytes) {
    if (UTF8) return UTF8.decode(new Uint8Array(bytes));
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
  }
  function decodeUpdateNodes(r) {
    const coordBytes = COORD === "i16" ? 2 : 4;
    const eats = [];
    const eatCount = r.remaining >= 2 ? r.u16() : 0;
    for (let i = 0; i < eatCount && r.remaining >= 8; i++) eats.push({ by: r.u32(), id: r.u32() });
    const updates = [];
    for (; ; ) {
      if (r.remaining < 4) break;
      const id = r.u32();
      if (id === 0) break;
      if (r.remaining < coordBytes * 2 + 3) break;
      const x = r.coord();
      const y = r.coord();
      const size = r.u16();
      const flags = r.u8();
      if (flags & 128) {
        if (r.remaining < 1) break;
        r.u8();
      }
      const isVirus = (flags & 1) !== 0;
      let color = null;
      if (flags & 2) {
        if (r.remaining < 3) break;
        color = { r: r.u8(), g: r.u8(), b: r.u8() };
      }
      const skin = flags & 4 ? r.str8() : null;
      const name = flags & 8 ? r.str8() : null;
      updates.push({ id, x, y, size, isVirus, color, name, skin });
    }
    const removes = [];
    const removeCount = r.remaining >= 2 ? r.u16() : 0;
    for (let i = 0; i < removeCount && r.remaining >= 4; i++) removes.push(r.u32());
    return { eats, updates, removes };
  }
  function decodeBorder(r) {
    return { minX: r.f64(), minY: r.f64(), maxX: r.f64(), maxY: r.f64() };
  }
  function decodeLeaderboard(r) {
    const out = [];
    const count = r.u32();
    if (count > 100) return out;
    for (let i = 0; i < count && r.remaining >= 4; i++) {
      const id = r.u32();
      out.push({ id, name: r.str8() });
    }
    return out;
  }
  function decodeServer(buf) {
    const r = new Reader(buf);
    const op = r.u8();
    switch (op) {
      case 16:
        return { t: "world", world: decodeUpdateNodes(r) };
      case 64:
        return { t: "border", border: decodeBorder(r) };
      case 32: {
        const ownIds = [];
        while (r.remaining >= 4) ownIds.push(r.u32());
        return { t: "own", ownIds };
      }
      case 17: {
        if (r.remaining < 12) return { t: "raw", op, len: buf.byteLength };
        const x = r.f32();
        const y = r.f32();
        const scale = r.f32();
        return { t: "camera", x, y, scale };
      }
      case 49:
        return { t: "leaderboard", entries: decodeLeaderboard(r) };
      case 98: {
        const flags = r.u8();
        const cr = r.u8(), cg = r.u8(), cb = r.u8();
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
  function hex(buf, max = 48) {
    const u = new Uint8Array(buf);
    const n = Math.min(u.length, max);
    let s = "";
    for (let i = 0; i < n; i++) s += u[i].toString(16).padStart(2, "0") + " ";
    return `${s}(${u.length}B)`;
  }

  // src/timers.ts
  var nativeSetInterval = window.setInterval.bind(window);
  function agxInterval(fn, ms) {
    return nativeSetInterval(fn, ms);
  }

  // src/settings.ts
  var DEFAULT_BOX_COUNT = 2;
  var ACTION_LABELS = {
    split: "Split",
    eject: "Eject (single)",
    macroFeed: "Eject / feed (hold)",
    doubleSplit: "Double split (x2)",
    split16: "Multi split (x4)",
    switchBox: "Switch box",
    respawn: "Respawn",
    pause: "Pause camera",
    spectateToggle: "Spectate: follow #1 / free",
    togglePellets: "Hide / show pellets"
  };
  var DEFAULT_BINDINGS = {
    split: "Space",
    eject: "",
    macroFeed: "KeyE",
    doubleSplit: "KeyG",
    split16: "KeyT",
    switchBox: "Tab",
    respawn: "Backquote",
    pause: "KeyP",
    spectateToggle: "KeyQ",
    togglePellets: "KeyX"
  };
  var DEFAULT_THEME = {
    showGrid: true,
    showMinimap: true,
    showLeaderboard: true,
    showMass: true,
    showKillFeed: true,
    showChat: true,
    showNames: true,
    customSkins: false,
    gameSkins: false,
    massFormat: "auto",
    ringSize: 1,
    pelletColor: "",
    showPellets: true,
    animatedBorder: true,
    cellShadow: true,
    spawnEffects: true,
    backgroundColor: "#0c0c16",
    backgroundUrl: "",
    activeOutline: "#ff3b30",
    inactiveOutline: "#ffffff"
  };
  var DEFAULT_GAME = {
    multiboxCamera: "single",
    zoomMode: "auto",
    inactiveBoxStops: false,
    spectatorView: false,
    drawDelay: 70,
    splitOp: 17,
    ejectOp: 21,
    chatOp: 98,
    autoFps: true,
    maxFps: 144,
    renderScale: 1
  };
  var emptyProfile = () => ({
    name: "",
    hue: 200,
    skins: Array.from({ length: DEFAULT_BOX_COUNT }, () => "")
  });
  var defaultProfiles = () => Array.from({ length: 9 }, emptyProfile);
  var STORAGE_KEY = "agarv2mod-settings";
  var BINDINGS_VERSION_KEY = "agarv2mod-bindv";
  var BINDINGS_VERSION = "4";
  var CHAT_OP_FIX_KEY = "agarv2mod-chatopfix";
  var SPECTATOR_OFF_KEY = "agarv2mod-specoff";
  function normalizeProfile(p) {
    const skins = Array.isArray(p == null ? void 0 : p.skins) ? p.skins.slice(0, DEFAULT_BOX_COUNT) : [];
    while (skins.length < DEFAULT_BOX_COUNT) skins.push("");
    return { name: typeof (p == null ? void 0 : p.name) === "string" ? p.name : "", hue: typeof (p == null ? void 0 : p.hue) === "number" ? p.hue : 200, skins };
  }
  function load() {
    var _a, _b, _c, _d, _e;
    const base = {
      profiles: defaultProfiles(),
      selected: 0,
      bindings: { ...DEFAULT_BINDINGS },
      theme: { ...DEFAULT_THEME },
      game: { ...DEFAULT_GAME }
    };
    try {
      const o = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Array.isArray(o.profiles) && o.profiles.length) base.profiles = o.profiles.map(normalizeProfile);
      if (typeof o.selected === "number") base.selected = Math.max(0, Math.min(8, o.selected));
      base.bindings = { ...DEFAULT_BINDINGS, ...(_a = o.bindings) != null ? _a : {} };
      base.theme = { ...DEFAULT_THEME, ...(_b = o.theme) != null ? _b : {} };
      base.game = { ...DEFAULT_GAME, ...(_c = o.game) != null ? _c : {} };
      const legacyDelay = (_d = o.game) == null ? void 0 : _d.animationDelay;
      if (typeof legacyDelay === "number" && typeof ((_e = o.game) == null ? void 0 : _e.drawDelay) !== "number") {
        base.game.drawDelay = Math.max(20, Math.min(400, 70));
      }
      if (!base.theme.backgroundColor) base.theme.backgroundColor = DEFAULT_THEME.backgroundColor;
      if (localStorage.getItem(BINDINGS_VERSION_KEY) !== BINDINGS_VERSION) {
        base.bindings = { ...DEFAULT_BINDINGS };
        try {
          localStorage.setItem(BINDINGS_VERSION_KEY, BINDINGS_VERSION);
        } catch {
        }
      }
      if (localStorage.getItem(CHAT_OP_FIX_KEY) !== "1") {
        base.game.chatOp = 98;
        try {
          localStorage.setItem(CHAT_OP_FIX_KEY, "1");
        } catch {
        }
      }
      if (localStorage.getItem(SPECTATOR_OFF_KEY) !== "1") {
        base.game.spectatorView = false;
        try {
          localStorage.setItem(SPECTATOR_OFF_KEY, "1");
        } catch {
        }
      }
    } catch {
    }
    return base;
  }
  var settings = load();
  save();
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
    }
  }
  function currentProfile() {
    var _a;
    return (_a = settings.profiles[settings.selected]) != null ? _a : emptyProfile();
  }
  function exportJson() {
    return JSON.stringify(settings, null, 2);
  }
  function importJson(json) {
    var _a, _b, _c;
    try {
      const o = JSON.parse(json);
      settings.profiles = Array.isArray(o.profiles) && o.profiles.length ? o.profiles.map(normalizeProfile) : defaultProfiles();
      settings.selected = typeof o.selected === "number" ? Math.max(0, Math.min(8, o.selected)) : 0;
      settings.bindings = { ...DEFAULT_BINDINGS, ...(_a = o.bindings) != null ? _a : {} };
      settings.theme = { ...DEFAULT_THEME, ...(_b = o.theme) != null ? _b : {} };
      settings.game = { ...DEFAULT_GAME, ...(_c = o.game) != null ? _c : {} };
      save();
      return true;
    } catch {
      return false;
    }
  }
  function formatMass(m, fmt) {
    const r = Math.round(m);
    const k = (x) => `${(x / 1e3).toFixed(1)}k`;
    if (fmt === "full") return r.toLocaleString();
    if (fmt === "short") return r >= 1e3 ? k(r) : String(r);
    return r >= 1e4 ? k(r) : r.toLocaleString();
  }
  function keyLabel(code) {
    if (!code) return "-";
    if (code === "Space") return "Space";
    if (code === "Tab") return "TAB";
    if (code === "Backquote") return "~";
    if (code.startsWith("Mouse")) {
      const b = Number(code.slice(5));
      if (b === 0) return "LMB";
      if (b === 1) return "MMB";
      if (b === 2) return "RMB";
      return `Mouse${b + 1}`;
    }
    return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Arrow/, "");
  }

  // src/world.ts
  var SKIN_PROXY = "https://agar2.emupedia.net/skin/";
  function hexEncode(s) {
    const enc = encodeURIComponent(s);
    let out = "";
    for (const ch of enc) out += ch.codePointAt(0).toString(16).padStart(2, "0");
    return out;
  }
  function hexDecode(s) {
    const pairs = s.match(/../g);
    if (!pairs) return "";
    let out = "";
    for (const h of pairs) out += String.fromCodePoint(parseInt(h, 16));
    try {
      return decodeURIComponent(out);
    } catch {
      return out;
    }
  }
  function resolveSkinUrl(raw, name) {
    var _a;
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
      const fp2 = ((_a = parts[5]) != null ? _a : "").trim();
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
  var World = class {
    constructor() {
      this.nodes = /* @__PURE__ */ new Map();
      this.ownIds = /* @__PURE__ */ new Set();
      this.border = { minX: -8e3, minY: -8e3, maxX: 8e3, maxY: 8e3 };
      this.leaderboard = [];
      this.specCam = null;
      this.spawnFxAt = -1e9;
      this.massAccum = 0;
    }
    get scrambleX() {
      return (this.border.minX + this.border.maxX) / 2;
    }
    get scrambleY() {
      return (this.border.minY + this.border.maxY) / 2;
    }
    apply(u) {
      var _a, _b, _c, _d;
      const now = performance.now();
      for (const e of u.eats) {
        this.nodes.delete(e.id);
        this.ownIds.delete(e.id);
      }
      for (const n of u.updates) {
        const ex = this.nodes.get(n.id);
        if (ex) {
          ex.x = n.x;
          ex.y = n.y;
          ex.size = n.size;
          ex.isVirus = n.isVirus;
          if (n.color) {
            ex.r = n.color.r;
            ex.g = n.color.g;
            ex.b = n.color.b;
            ex.css = `rgb(${ex.r},${ex.g},${ex.b})`;
          }
          let reskin = false;
          if (n.name !== null && n.name !== ex.name) {
            ex.name = n.name;
            reskin = true;
          }
          if (n.skin !== null && n.skin !== ex.skin) {
            ex.skin = n.skin;
            reskin = true;
          }
          if (reskin) ex.skinUrl = resolveSkinUrl(ex.skin, ex.name);
        } else {
          const cr = n.color ? n.color.r : 220;
          const cg = n.color ? n.color.g : 220;
          const cb = n.color ? n.color.b : 220;
          this.nodes.set(n.id, {
            id: n.id,
            x: n.x,
            y: n.y,
            size: n.size,
            isVirus: n.isVirus,
            r: cr,
            g: cg,
            b: cb,
            css: `rgb(${cr},${cg},${cb})`,
            name: (_a = n.name) != null ? _a : "",
            skin: (_b = n.skin) != null ? _b : "",
            skinUrl: resolveSkinUrl((_c = n.skin) != null ? _c : "", (_d = n.name) != null ? _d : ""),
            born: now,
            rx: n.x,
            ry: n.y,
            rsize: n.size,
            dispMass: n.size * n.size / 100,
            massStr: n.name || n.size >= 40 ? formatMass(n.size * n.size / 100, settings.theme.massFormat) : ""
          });
        }
      }
      for (const id of u.removes) {
        this.nodes.delete(id);
        this.ownIds.delete(id);
      }
    }
    setOwn(ids) {
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
    step(dt) {
      const delay = Math.max(20, Math.min(400, settings.game.drawDelay || 70));
      const k = 1 - Math.exp(-1e3 / delay * dt);
      this.massAccum += dt;
      const refreshMass = this.massAccum >= 0.5;
      if (refreshMass) this.massAccum = 0;
      for (const n of this.nodes.values()) {
        n.rx += (n.x - n.rx) * k;
        n.ry += (n.y - n.ry) * k;
        n.rsize += (n.size - n.rsize) * k;
        if (refreshMass) {
          n.dispMass = n.size * n.size / 100;
          if (n.name || n.rsize >= 40) n.massStr = formatMass(n.dispMass, settings.theme.massFormat);
        }
      }
    }
    ownCenter() {
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
  };

  // src/client.ts
  var PING = new Uint8Array([254]).buffer;
  var KEEPALIVE_MS = 5e3;
  var WS_TOKEN_SECRET = "tFoL46WDlZuRja7W6qCl";
  async function sha256Hex2(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function mintWsToken() {
    const ts = Date.now().toString();
    const uuid = crypto.randomUUID().replaceAll("-", "");
    const hash = await sha256Hex2([ts, uuid, location.origin, WS_TOKEN_SECRET].join("."));
    return `${ts}.${uuid}.${hash}`;
  }
  var SocketClient = class {
    constructor(label, url, handshake, log2, onChat) {
      this.label = label;
      this.url = url;
      this.handshake = handshake;
      this.log = log2;
      this.onChat = onChat;
      this.ws = null;
      this.world = new World();
      this.open = false;
      this.worldEnabled = true;
      this.ping = 0;
      this.pingTimer = 0;
      this.lastPingAt = 0;
      this.awaitingPong = false;
      this.pingSamples = [];
    }
    async connect() {
      this.stopPing();
      let token;
      try {
        token = await mintWsToken();
      } catch (e) {
        this.log(`[agarv2mod] ${this.label}: token mint failed`, e);
        return;
      }
      this.log(`[agarv2mod] ${this.label}: connecting`, this.url.slice(0, 80), `proto=${token.slice(0, 13)}`);
      let ws;
      try {
        ws = new WebSocket(this.url, token);
      } catch (e) {
        this.log(`[agarv2mod] ${this.label}: connect threw`, e);
        return;
      }
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      ws.addEventListener("open", () => {
        this.log(`[agarv2mod] ${this.label}: open - replaying ${this.handshake.length} handshake packet(s)`);
        for (const h of this.handshake) {
          try {
            ws.send(h);
          } catch (e) {
            this.log(`${this.label} send err`, e);
          }
        }
        this.open = true;
      });
      ws.addEventListener("message", (ev) => {
        var _a;
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
            case "world":
              this.world.apply(e.world);
              break;
            case "border":
              this.world.border = e.border;
              break;
            case "own":
              this.world.setOwn(e.ownIds);
              break;
            case "leaderboard":
              this.world.leaderboard = e.entries;
              break;
            case "camera":
              this.world.specCam = { x: e.x, y: e.y, at: performance.now() };
              break;
            case "chat":
              (_a = this.onChat) == null ? void 0 : _a.call(this, e.name, e.message, e.color);
              break;
            case "clear":
              this.world.clear();
              break;
            case "raw":
              break;
          }
        } catch (err) {
          this.log(`[agarv2mod] ${this.label}: decode error`, err, hex(ev.data));
        }
      });
      ws.addEventListener("close", (ev) => {
        if (this.ws === ws) this.open = false;
        this.log(`[agarv2mod] ${this.label}: closed code=${ev.code} reason=${ev.reason || "-"}`);
      });
      ws.addEventListener("error", () => this.log(`[agarv2mod] ${this.label}: socket error`));
      this.pingTimer = agxInterval(() => {
        var _a;
        if (((_a = this.ws) == null ? void 0 : _a.readyState) === WebSocket.OPEN) {
          try {
            this.lastPingAt = performance.now();
            this.awaitingPong = true;
            this.ws.send(PING);
          } catch {
          }
        }
      }, KEEPALIVE_MS);
    }
    stopPing() {
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = 0;
      }
      this.awaitingPong = false;
    }
    setHandshake(h) {
      this.handshake = h;
    }
    reconnect() {
      var _a;
      this.log(`[agarv2mod] ${this.label}: leaving + rejoining`);
      try {
        (_a = this.ws) == null ? void 0 : _a.close();
      } catch {
      }
      this.ws = null;
      this.open = false;
      this.world.clear();
      void this.connect();
    }
    hasCell() {
      for (const id of this.world.ownIds) if (this.world.nodes.has(id)) return true;
      return false;
    }
    send(buf) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(buf);
    }
    close() {
      var _a;
      this.stopPing();
      try {
        (_a = this.ws) == null ? void 0 : _a.close();
      } catch {
      }
      this.ws = null;
      this.open = false;
    }
  };

  // src/encode.ts
  var MOVE_OP = 0x0f;
  var SPAWN_OP = 0x05;
  function encodeMove(x, y, fmt) {
    if (fmt === "f64") {
      const b2 = new ArrayBuffer(21);
      const v2 = new DataView(b2);
      v2.setUint8(0, MOVE_OP);
      v2.setFloat64(1, x, true);
      v2.setFloat64(9, y, true);
      v2.setUint32(17, 0, true);
      return b2;
    }
    const b = new ArrayBuffer(13);
    const v = new DataView(b);
    v.setUint8(0, MOVE_OP);
    v.setInt32(1, Math.round(x), true);
    v.setInt32(5, Math.round(y), true);
    v.setUint32(9, 0, true);
    return b;
  }
  function tagField(v, max) {
    return v.trim().replace(/[<>|]/g, "").slice(0, max);
  }
  function encodeOgarSpawn(nick, fp2, skin = "lightning", nameColor = "#ffffff", cellColor = "#ffffff", borderColor = "#ffffff") {
    const s = `<${tagField(skin, 30)}|${tagField(nameColor, 7)}|${tagField(cellColor, 7)}|${tagField(borderColor, 7)}||${tagField(fp2, 64)}>${nick}`;
    const utf8 = new TextEncoder().encode(s);
    const b = new ArrayBuffer(1 + utf8.length + 1);
    const bytes = new Uint8Array(b);
    bytes[0] = SPAWN_OP;
    bytes.set(utf8, 1);
    bytes[1 + utf8.length] = 0;
    return b;
  }
  function encodeChat(message, op) {
    const utf8 = new TextEncoder().encode(message);
    const b = new ArrayBuffer(2 + utf8.length + 1);
    const bytes = new Uint8Array(b);
    bytes[0] = op;
    bytes[1] = 0;
    bytes.set(utf8, 2);
    bytes[2 + utf8.length] = 0;
    return b;
  }

  // src/multibox.ts
  var CHIP_COLORS = ["#22d3ee", "#fbbf24"];
  var MACRO_FEED_MS = 70;
  var SPECTATE_OP = 0x01;
  var QKEY_DOWN_OP = 18;
  var QKEY_UP_OP = 19;
  var ENABLE_SECOND_SOCKET = true;
  var RELAY_URL = "";
  var WS2_URL = `wss://ogar.arenarcade.com/ws/`;
  var PROTOCOL_VERSION = 6;
  var HANDSHAKE_KEY = 1;
  var SHARE_SKINS_VIA_CHAT = false;
  var Multibox = class {
    constructor(log2, skinShare2, chat2) {
      this.log = log2;
      this.skinShare = skinShare2;
      this.chat = chat2;
      this.active = 0;
      this.overlay = null;
      this.moveFmt = "i32";
      this.mouseX = 0;
      this.mouseY = 0;
      this.aim = [];
      this.aliveState = [];
      this.tickN = 0;
      this.connecting = false;
      this.macroFeedHeld = false;
      this.lastFeed = 0;
      this.lastAnnounce = 0;
      this.chatNick = "";
      this.lastSpecKick = 0;
      this.spectateKicked = false;
      this.pendingRespawn = null;
      this.respawnStart = 0;
      this.paused = false;
      this.mode = "menu";
      this.freeRoam = false;
      this.fps = 0;
      this.onAllDead = null;
      this.wasAlive = false;
      this.recentChat = /* @__PURE__ */ new Map();
      this.auxClient = null;
      this.warnedOps = false;
      this._layers = [];
      this._theme = {};
      this.spectateWorld = new World();
      this.players = [
        { world: new World(), client: null, deployed: false },
        { world: new World(), client: null, deployed: false }
      ];
      window.addEventListener("mousemove", (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });
      this.chatNick = this.nick();
      agxInterval(() => this.tick(), 1e3 / 33);
      agxInterval(() => this.autoConnect(), 800);
      agxInterval(() => this.announceSkin(), 15e3);
    }
    attachOverlay(o) {
      this.overlay = o;
    }
    build254() {
      return new Uint8Array([254, PROTOCOL_VERSION, 0, 0, 0]).buffer;
    }
    build255() {
      const name = new TextEncoder().encode(this.nick());
      const out = new ArrayBuffer(5 + name.length + 1);
      const ov = new DataView(out);
      ov.setUint8(0, 255);
      ov.setUint32(1, HANDSHAKE_KEY, true);
      new Uint8Array(out).set(name, 5);
      return out;
    }
    autoConnect() {
      var _a, _b, _c, _d;
      if (this.connecting) return;
      const p254 = this.build254();
      const p255 = this.build255();
      const auxRs = (_b = (_a = this.auxClient) == null ? void 0 : _a.ws) == null ? void 0 : _b.readyState;
      if (auxRs !== WebSocket.OPEN && auxRs !== WebSocket.CONNECTING) {
        this.connecting = true;
        void this.connectAux(p254, p255).finally(() => this.connecting = false);
        return;
      }
      const last = ENABLE_SECOND_SOCKET ? this.players.length : 1;
      for (let i = 0; i < last; i++) {
        const rs = (_d = (_c = this.players[i].client) == null ? void 0 : _c.ws) == null ? void 0 : _d.readyState;
        if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) continue;
        this.connecting = true;
        void this.connectBox(i, p254, p255).finally(() => this.connecting = false);
        return;
      }
    }
    async connectAux(p254, p255) {
      const url = RELAY_URL || WS2_URL;
      const aux = new SocketClient(
        "AUX",
        url,
        [p254, p255],
        this.log,
        (name, message, color) => this.ingestChat(name, message, color)
      );
      aux.worldEnabled = false;
      this.auxClient = aux;
      this.spectateWorld = aux.world;
      await aux.connect();
      this.log("[agarv2mod] aux (chat/spectate) socket connecting");
    }
    async connectBox(idx, p254, p255) {
      const url = RELAY_URL || WS2_URL;
      const client = new SocketClient(`P${idx + 1}`, url, [p254, p255], this.log);
      client.worldEnabled = false;
      this.players[idx] = { world: client.world, client, deployed: false };
      await client.connect();
      this.log(`[agarv2mod] box ${idx + 1} socket connecting (handshake only - Play/TAB to deploy)`);
    }
    ingestChat(name, message, color) {
      if (this.skinShare.ingest(message)) return;
      if (/antispam/i.test(message)) return;
      const now = performance.now();
      const k = name + " " + message;
      const seen = this.recentChat.get(k);
      if (seen !== void 0 && now - seen < 5e3) return;
      this.recentChat.set(k, now);
      if (this.recentChat.size > 128) {
        for (const [kk, t] of this.recentChat) if (now - t > 8e3) this.recentChat.delete(kk);
      }
      this.chat.add(name, message, color);
    }
    nick() {
      return (currentProfile().name || "An unnamed cell").slice(0, 15);
    }
    alive(p) {
      for (const id of p.world.ownIds) if (p.world.nodes.has(id)) return true;
      return false;
    }
    play() {
      var _a;
      this.mode = "playing";
      this.paused = false;
      this.freeRoam = false;
      if (settings.game.spectatorView) {
        settings.game.spectatorView = false;
        save();
      }
      this.active = 0;
      this.syncChatNick();
      if ((_a = this.players[0].client) == null ? void 0 : _a.open) {
        this.spawnBox(0);
      } else {
        this.pendingRespawn = 0;
        this.respawnStart = performance.now();
        this.log("[agarv2mod] Play: box 1 socket still connecting - will spawn when ready");
      }
    }
    respawn() {
      const mass = this.activeMass();
      if (mass > 500) {
        this.log(`[agarv2mod] quick respawn blocked - box mass ${Math.round(mass)} > 500 (too big to risk)`);
        return;
      }
      this.mode = "playing";
      this.paused = false;
      this.leaveAndRejoin(this.active);
    }
    activeMass() {
      const p = this.players[this.active];
      if (!p) return 0;
      let m = 0;
      for (const id of p.world.ownIds) {
        const n = p.world.nodes.get(id);
        if (n) m += n.dispMass;
      }
      return m;
    }
    leaveAndRejoin(idx) {
      const p = this.players[idx];
      if (!(p == null ? void 0 : p.client)) {
        this.log(`[agarv2mod] quick respawn box ${idx + 1}: not connected yet`);
        return;
      }
      this.pendingRespawn = idx;
      this.respawnStart = performance.now();
      this.log(`[agarv2mod] quick respawn box ${idx + 1}: leaving server...`);
      p.client.reconnect();
    }
    spawnPending() {
      var _a, _b;
      if (this.pendingRespawn === null) return;
      const idx = this.pendingRespawn;
      const p = this.players[idx];
      const elapsed = performance.now() - this.respawnStart;
      if (((_a = p == null ? void 0 : p.client) == null ? void 0 : _a.open) && elapsed > 250) {
        this.pendingRespawn = null;
        this.active = idx;
        this.spawnBox(idx);
        (_b = this.overlay) == null ? void 0 : _b.snapCamera();
        this.log(`[agarv2mod] quick respawn box ${idx + 1}: rejoined -> spawned`);
      } else if (elapsed > 9e3) {
        this.pendingRespawn = null;
        this.log(`[agarv2mod] quick respawn box ${idx + 1}: timed out waiting to reconnect`);
      }
    }
    syncChatNick() {
      const want = this.nick();
      if (want !== this.chatNick) {
        this.chatNick = want;
        const aux = this.auxClient;
        if (aux) {
          aux.setHandshake([this.build254(), this.build255()]);
          aux.reconnect();
        }
        this.log(`[agarv2mod] chat nick -> "${want}"`);
      }
    }
    refreshChatNick() {
      this.syncChatNick();
    }
    buildSpawn(nick, skin) {
      const fp2 = getFp2Sync();
      if (!fp2) return null;
      const colors = profileColors(currentProfile().hue);
      return encodeOgarSpawn(nick, fp2, skin, colors.nameColor, colors.cellColor, colors.borderColor);
    }
    spawnBox(idx) {
      const p = this.players[idx];
      if (!p) return;
      const nick = this.nick();
      const pkt = this.buildSpawn(nick, "");
      if (!pkt) {
        this.log("[agarv2mod] no fp2 yet - wait for fingerprint init");
        return;
      }
      if (!p.client) {
        this.log(`[agarv2mod] box ${idx + 1} not connected yet - cannot spawn`);
        return;
      }
      p.client.worldEnabled = true;
      p.client.send(pkt);
      p.deployed = true;
      this.announceSkin();
      this.log(`[agarv2mod] opcode-20 spawn box ${idx + 1} (nick="${nick}")`);
    }
    spectate() {
      if (this.mode === "spectating") return;
      if (this.players.some((p) => this.alive(p))) {
        this.log("[agarv2mod] spectate blocked - a box is still alive (it would keep starving)");
        return;
      }
      this.mode = "spectating";
      this.paused = false;
      this.freeRoam = false;
      this.spectateWorld.specCam = null;
      this.log("[agarv2mod] spectate (aux socket) - follow top player, press Q for free roam");
    }
    spectateOrRoam() {
      var _a;
      if (this.mode !== "spectating") {
        this.spectate();
        return;
      }
      this.freeRoam = !this.freeRoam;
      const aux = this.auxClient;
      if (((_a = aux == null ? void 0 : aux.ws) == null ? void 0 : _a.readyState) === WebSocket.OPEN) {
        aux.send(this.oneByte(QKEY_DOWN_OP));
        window.setTimeout(() => {
          var _a2;
          if (((_a2 = aux.ws) == null ? void 0 : _a2.readyState) === WebSocket.OPEN) aux.send(this.oneByte(QKEY_UP_OP));
        }, 40);
        if (!this.freeRoam) {
          window.setTimeout(() => {
            var _a2;
            if (this.mode === "spectating" && ((_a2 = aux.ws) == null ? void 0 : _a2.readyState) === WebSocket.OPEN) aux.send(this.oneByte(SPECTATE_OP));
          }, 90);
        }
      }
      if (this.freeRoam) this.log("[agarv2mod] free roam - the camera flies toward your mouse");
      else this.log("[agarv2mod] spectate - follow top player");
    }
    manageSpectate(now) {
      var _a;
      const aux = this.auxClient;
      if (!aux || ((_a = aux.ws) == null ? void 0 : _a.readyState) !== WebSocket.OPEN) return;
      const wantStream = this.mode === "spectating" || settings.game.spectatorView;
      if (wantStream) {
        if (!aux.worldEnabled) aux.worldEnabled = true;
        if (!this.spectateKicked || !this.freeRoam && aux.world.nodes.size === 0 && now - this.lastSpecKick > 3e3) {
          this.spectateKicked = true;
          this.lastSpecKick = now;
          aux.send(this.oneByte(SPECTATE_OP));
          window.setTimeout(() => {
            var _a2;
            if ((this.mode === "spectating" || settings.game.spectatorView) && ((_a2 = aux.ws) == null ? void 0 : _a2.readyState) === WebSocket.OPEN) {
              aux.send(this.oneByte(SPECTATE_OP));
            }
          }, 300);
          this.log("[agarv2mod] spectate: requesting aux stream (follow-leader)");
        }
      } else if (aux.worldEnabled) {
        aux.worldEnabled = false;
        aux.world.clear();
        this.spectateKicked = false;
        aux.reconnect();
        this.log("[agarv2mod] spectate off - aux socket recycled so the next spectate gets fresh cell colors");
      }
    }
    switchActive() {
      var _a;
      if (!ENABLE_SECOND_SOCKET) {
        this.log("[agarv2mod] single-socket mode - box 2 disabled");
        return;
      }
      const n = this.players.length;
      let next = -1;
      for (let i = 1; i <= n; i++) {
        const idx = (this.active + i) % n;
        if (this.controllable(this.players[idx])) {
          next = idx;
          break;
        }
      }
      if (next < 0) {
        this.log("[agarv2mod] no other box connected yet");
        return;
      }
      this.active = next;
      const p = this.players[next];
      if (!this.alive(p)) this.spawnBox(next);
      if (settings.game.multiboxCamera === "single") (_a = this.overlay) == null ? void 0 : _a.snapCamera();
      this.log(`[agarv2mod] active -> box ${this.active + 1}`);
    }
    sendTo(p, buf) {
      var _a;
      (_a = p.client) == null ? void 0 : _a.send(buf);
    }
    sendActive(buf) {
      this.sendTo(this.players[this.active], buf);
    }
    oneByte(op) {
      return new Uint8Array([op]).buffer;
    }
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
    warnOps() {
      if (this.warnedOps) return;
      this.warnedOps = true;
      this.log("[agarv2mod] split/eject opcode not set - Settings -> Controls (or read it from the packet log)");
    }
    macroSplit(times) {
      const op = settings.game.splitOp;
      if (op <= 0) {
        this.warnOps();
        return;
      }
      const box = this.active;
      const p = this.players[box];
      const aim = this.aim[box];
      this.log(`[agarv2mod] macro split x${times} on box ${box + 1} (op ${op})`);
      for (let i = 0; i < times; i++) {
        window.setTimeout(() => {
          if (!this.controllable(p)) return;
          if (aim) this.sendTo(p, encodeMove(aim.x, aim.y, this.moveFmt));
          this.sendTo(p, this.oneByte(op));
        }, i * 60);
      }
    }
    doubleSplit() {
      this.macroSplit(2);
    }
    split16() {
      this.macroSplit(4);
    }
    setMacroFeed(held) {
      this.macroFeedHeld = held;
      if (held) {
        this.lastFeed = 0;
        this.eject();
      }
    }
    togglePause() {
      this.paused = !this.paused;
    }
    sendChat(text) {
      var _a, _b;
      const msg = text.trim().slice(0, 200);
      if (!msg) return;
      const op = settings.game.chatOp;
      if (op <= 0) {
        this.log("[agarv2mod] chat opcode not set (Settings -> Controls)");
        return;
      }
      const me = this.nick();
      this.recentChat.set(me + " " + msg, performance.now());
      this.chat.add(me, msg, "#67e8f9");
      const buf = encodeChat(msg, op);
      if (((_b = (_a = this.auxClient) == null ? void 0 : _a.ws) == null ? void 0 : _b.readyState) === WebSocket.OPEN) {
        this.auxClient.send(buf);
        this.log(`[agarv2mod] chat -> "${msg}" (op ${op}, aux)`);
        return;
      }
      const p = this.players.find((pl) => {
        var _a2, _b2;
        return ((_b2 = (_a2 = pl.client) == null ? void 0 : _a2.ws) == null ? void 0 : _b2.readyState) === WebSocket.OPEN;
      });
      if (p) {
        p.client.send(buf);
        this.log(`[agarv2mod] chat -> "${msg}" (op ${op}, box)`);
      } else {
        this.log(`[agarv2mod] chat -> "${msg}" failed (no socket open)`);
      }
    }
    announceSkin() {
      if (!SHARE_SKINS_VIA_CHAT) return;
      if (!settings.theme.customSkins || this.mode !== "playing") return;
      const url = (currentProfile().skins.find((s) => !!s) || "").trim();
      if (!url) return;
      const op = settings.game.chatOp;
      if (op <= 0) return;
      const now = performance.now();
      if (now - this.lastAnnounce < 7e3) return;
      this.lastAnnounce = now;
      const box = this.players.find((pl) => {
        var _a, _b;
        return ((_b = (_a = pl.client) == null ? void 0 : _a.ws) == null ? void 0 : _b.readyState) === WebSocket.OPEN;
      });
      if (box == null ? void 0 : box.client) box.client.send(encodeChat(this.skinShare.encode(this.nick(), url), op));
    }
    sharedSkin(name) {
      if (this.skinShare.size === 0 || !name) return "";
      return this.skinShare.get(name);
    }
    controllable(p) {
      var _a, _b;
      return ((_b = (_a = p.client) == null ? void 0 : _a.ws) == null ? void 0 : _b.readyState) === WebSocket.OPEN;
    }
    running() {
      return this.mode !== "menu";
    }
    layers() {
      var _a;
      const ls = this._layers;
      let n = 0;
      for (let i = 0; i < this.players.length; i++) {
        let e = ls[n];
        if (!e) e = ls[n] = { world: this.players[i].world, active: i === this.active };
        else {
          e.world = this.players[i].world;
          e.active = i === this.active;
        }
        n++;
      }
      if ((_a = this.auxClient) == null ? void 0 : _a.worldEnabled) {
        let e = ls[n];
        if (!e) e = ls[n] = { world: this.spectateWorld, active: false };
        else {
          e.world = this.spectateWorld;
          e.active = false;
        }
        n++;
      }
      ls.length = n;
      return ls;
    }
    themeFor() {
      const t = settings.theme;
      const o = this._theme;
      o.grid = t.showGrid;
      o.names = t.showNames;
      o.mass = t.showMass;
      o.minimap = t.showMinimap;
      o.shadows = t.cellShadow;
      o.customSkins = t.customSkins;
      o.gameSkins = t.gameSkins;
      o.massFormat = t.massFormat;
      o.ringSize = t.ringSize;
      o.pelletColor = t.pelletColor;
      o.showPellets = t.showPellets;
      o.animatedBorder = t.animatedBorder;
      o.spawnEffects = t.spawnEffects;
      o.backgroundColor = t.backgroundColor;
      o.backgroundUrl = t.backgroundUrl;
      o.activeOutline = t.activeOutline;
      o.inactiveOutline = t.inactiveOutline;
      return o;
    }
    realOwnCenter(p) {
      const c = p.world.ownCenter();
      if (!c) return null;
      return { cx: c.cx - p.world.scrambleX, cy: c.cy - p.world.scrambleY, radius: c.radius };
    }
    cameraTarget() {
      var _a, _b;
      if (this.paused) return null;
      if (this.mode === "spectating") {
        const w = this.spectateWorld;
        if (this.freeRoam && w.specCam && performance.now() - w.specCam.at < 2500) {
          return { cx: w.specCam.x - w.scrambleX, cy: w.specCam.y - w.scrambleY, radius: 300 };
        }
        return this.biggestInWorld(w);
      }
      if (settings.game.multiboxCamera === "center") {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, aliveBoxes = 0;
        for (const p of this.players) {
          let any = false;
          for (const id of p.world.ownIds) {
            const n = p.world.nodes.get(id);
            if (!n) continue;
            any = true;
            const rx = n.rx - p.world.scrambleX, ry = n.ry - p.world.scrambleY;
            minX = Math.min(minX, rx - n.rsize);
            minY = Math.min(minY, ry - n.rsize);
            maxX = Math.max(maxX, rx + n.rsize);
            maxY = Math.max(maxY, ry + n.rsize);
          }
          if (any) aliveBoxes++;
        }
        if (aliveBoxes >= 2) return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, radius: Math.max((maxX - minX) / 2, (maxY - minY) / 2) };
      }
      return (_b = (_a = this.realOwnCenter(this.players[this.active])) != null ? _a : this.realOwnCenter(this.players[0])) != null ? _b : this.biggestCellReal();
    }
    worldBorder() {
      const w = this.players[this.active].world;
      return {
        minX: w.border.minX - w.scrambleX,
        minY: w.border.minY - w.scrambleY,
        maxX: w.border.maxX - w.scrambleX,
        maxY: w.border.maxY - w.scrambleY
      };
    }
    leaderboard() {
      const b1 = this.players[0].world.leaderboard;
      return b1.length ? b1 : this.spectateWorld.leaderboard;
    }
    biggestInWorld(w) {
      let best = null;
      for (const n of w.nodes.values()) {
        if (n.isVirus || !n.name && n.rsize < 40) continue;
        if (!best || n.rsize > best.radius) best = { cx: n.rx - w.scrambleX, cy: n.ry - w.scrambleY, radius: n.rsize };
      }
      return best;
    }
    biggestCellReal() {
      let best = null;
      const worlds = this.players.map((p) => p.world);
      if (this.mode === "spectating") worlds.push(this.spectateWorld);
      for (const w of worlds) {
        for (const n of w.nodes.values()) {
          if (n.isVirus || !n.name && n.rsize < 40) continue;
          if (!best || n.rsize > best.radius) best = { cx: n.rx - w.scrambleX, cy: n.ry - w.scrambleY, radius: n.rsize };
        }
      }
      return best;
    }
    pingMs() {
      var _a, _b, _c, _d;
      const aux = this.auxClient;
      if (this.mode === "spectating" && aux && ((_a = aux.ws) == null ? void 0 : _a.readyState) === WebSocket.OPEN && aux.ping > 0) return aux.ping;
      const a = (_b = this.players[this.active]) == null ? void 0 : _b.client;
      if (a && ((_c = a.ws) == null ? void 0 : _c.readyState) === WebSocket.OPEN && a.ping > 0) return a.ping;
      if (aux && ((_d = aux.ws) == null ? void 0 : _d.readyState) === WebSocket.OPEN && aux.ping > 0) return aux.ping;
      return 0;
    }
    hud() {
      var _a, _b;
      let cellCount = 0;
      const players = this.players.map((p, i) => {
        let mass = 0, cells = 0;
        for (const id of p.world.ownIds) {
          const n = p.world.nodes.get(id);
          if (n) {
            mass += n.dispMass;
            cells++;
          }
        }
        cellCount += cells;
        return {
          label: `${i + 1}`,
          alive: cells > 0,
          connected: this.controllable(p),
          active: i === this.active,
          mass: Math.round(mass),
          color: CHIP_COLORS[i % CHIP_COLORS.length]
        };
      });
      return {
        active: this.active,
        boxCount: this.players.length,
        cellCount,
        mass: (_b = (_a = players[this.active]) == null ? void 0 : _a.mass) != null ? _b : 0,
        ping: this.pingMs(),
        players
      };
    }
    get status() {
      var _a, _b;
      const auxRs = (_b = (_a = this.auxClient) == null ? void 0 : _a.ws) == null ? void 0 : _b.readyState;
      const aux = auxRs === WebSocket.OPEN ? "open" : auxRs === WebSocket.CONNECTING ? "conn" : "down";
      const boxes = this.players.map((p, i) => {
        var _a2, _b2;
        const r = (_b2 = (_a2 = p.client) == null ? void 0 : _a2.ws) == null ? void 0 : _b2.readyState;
        const rs = r === WebSocket.OPEN ? "open" : r === WebSocket.CONNECTING ? "conn" : "closed";
        const cells = [...p.world.ownIds].filter((id) => p.world.nodes.has(id)).length;
        return `${i === this.active ? ">" : " "}${i + 1}:${rs}(${cells})`;
      }).join("  ");
      return `aux(chat/spec):${aux}  ${boxes}`;
    }
    tick() {
      var _a, _b;
      if (!this.overlay) return;
      this.spawnPending();
      this.manageSpectate(performance.now());
      if (!this.controllable(this.players[this.active])) this.active = 0;
      for (let i = 0; i < this.players.length; i++) {
        const al = this.alive(this.players[i]);
        if (!this.aliveState[i] && al) {
          const w = this.players[i].world;
          w.spawnFxAt = performance.now();
          for (const id of w.ownIds) {
            const n = w.nodes.get(id);
            if (n) n.born = w.spawnFxAt;
          }
          if (i === this.active) this.overlay.snapCamera();
        }
        if (this.aliveState[i] && !al && i === this.active && i !== this.pendingRespawn) {
          const j = this.players.findIndex((p, k) => k !== i && this.controllable(p) && this.alive(p));
          if (j >= 0) {
            this.active = j;
            this.overlay.snapCamera();
            this.log(`[agarv2mod] box ${i + 1} died -> switch to box ${j + 1}`);
          }
        }
        this.aliveState[i] = al;
      }
      const anyAlive = this.players.some((p) => this.alive(p));
      if (this.wasAlive && !anyAlive && this.mode === "playing" && this.pendingRespawn === null) {
        this.log("[agarv2mod] all boxes died - back to menu");
        (_a = this.onAllDead) == null ? void 0 : _a.call(this);
      }
      this.wasAlive = anyAlive;
      const now = performance.now();
      if (this.macroFeedHeld && this.mode === "playing" && !this.paused && now - this.lastFeed > MACRO_FEED_MS) {
        this.lastFeed = now;
        this.eject();
      }
      if (this.paused) return;
      if (this.mode === "spectating") {
        if (this.freeRoam) this.sendRoam();
        return;
      }
      this.tickN++;
      const cursor = this.overlay.screenToWorld(this.mouseX, this.mouseY);
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (!this.controllable(p)) continue;
        if (i !== this.active && this.tickN % 4 !== 0) continue;
        let tx, ty;
        if (i === this.active) {
          tx = cursor.x + p.world.scrambleX;
          ty = cursor.y + p.world.scrambleY;
          this.aim[i] = { x: tx, y: ty };
        } else if (settings.game.inactiveBoxStops) {
          const c = p.world.ownCenter();
          if (!c) continue;
          tx = c.cx;
          ty = c.cy;
        } else {
          const a = (_b = this.aim[i]) != null ? _b : p.world.ownCenter() && { x: p.world.ownCenter().cx, y: p.world.ownCenter().cy };
          if (!a) continue;
          tx = a.x;
          ty = a.y;
        }
        this.sendTo(p, encodeMove(tx, ty, this.moveFmt));
      }
    }
    sendRoam() {
      var _a;
      const aux = this.auxClient;
      if (!aux || ((_a = aux.ws) == null ? void 0 : _a.readyState) !== WebSocket.OPEN || !this.overlay) return;
      const cur = this.overlay.screenToWorld(this.mouseX, this.mouseY);
      const w = this.spectateWorld;
      aux.send(encodeMove(cur.x + w.scrambleX, cur.y + w.scrambleY, this.moveFmt));
    }
  };

  // src/camera.ts
  function clampScale(scale) {
    if (scale < 0.04) return 0.04;
    if (scale > 2) return 2;
    return scale;
  }
  var Camera = class {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.scale = 0.25;
      this.targetX = 0;
      this.targetY = 0;
      this.targetScale = 0.25;
      this.viewportW = 1;
      this.viewportH = 1;
      this.snapNext = false;
    }
    setViewport(w, h) {
      this.viewportW = w;
      this.viewportH = h;
    }
    snap() {
      this.snapNext = true;
    }
    pan(dx, dy) {
      const sx = dx / this.scale;
      const sy = dy / this.scale;
      this.x -= sx;
      this.targetX -= sx;
      this.y -= sy;
      this.targetY -= sy;
    }
    frame(minX, minY, maxX, maxY) {
      this.targetX = (minX + maxX) / 2;
      this.targetY = (minY + maxY) / 2;
      const pad = 1200;
      const w = maxX - minX + pad * 2;
      const h = maxY - minY + pad * 2;
      const sx = this.viewportW / w;
      const sy = this.viewportH / h;
      this.targetScale = Math.max(0.03, Math.min(0.55, Math.min(sx, sy)));
    }
    focus(cx, cy, scale) {
      this.targetX = cx;
      this.targetY = cy;
      this.targetScale = clampScale(scale);
    }
    setTargetScale(scale) {
      this.targetScale = clampScale(scale);
    }
    update(dt, responsiveness = 1) {
      if (this.snapNext) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.scale = this.targetScale;
        this.snapNext = false;
        return;
      }
      const posK = 1 - Math.exp(-8 * responsiveness * dt);
      this.x += (this.targetX - this.x) * posK;
      this.y += (this.targetY - this.y) * posK;
      const scaleK = 1 - Math.exp(-4 * responsiveness * dt);
      this.scale += (this.targetScale - this.scale) * scaleK;
    }
    screenToWorld(sx, sy) {
      return {
        x: this.x + (sx - this.viewportW / 2) / this.scale,
        y: this.y + (sy - this.viewportH / 2) / this.scale
      };
    }
  };

  // src/overlay.ts
  var MAX_VIEW = 3e4;
  var AUTO_MAX_VIEW = 11e3;
  var MAX_CELLS = 600;
  var MAX_FOOD = 1200;
  var FULL_BUDGET = 240;
  var FOOD_BUCKET_COLORS = Array.from({ length: 64 }, (_, k) => {
    const r = (k >> 4) * 85, g = (k >> 2 & 3) * 85, b = (k & 3) * 85;
    return `rgb(${r},${g},${b})`;
  });
  var ImageCache = class {
    constructor() {
      this.images = /* @__PURE__ */ new Map();
      this.failed = /* @__PURE__ */ new Set();
    }
    get(url) {
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
  };
  var _NameCache = class _NameCache {
    constructor() {
      this.map = /* @__PURE__ */ new Map();
      this.builtThisFrame = 0;
    }
    beginFrame() {
      this.builtThisFrame = 0;
    }
    get(name) {
      const e = this.map.get(name);
      if (e) return e;
      if (this.builtThisFrame >= _NameCache.MAX_PER_FRAME) return null;
      let m = _NameCache.measure;
      if (!m) {
        m = _NameCache.measure = document.createElement("canvas").getContext("2d");
        if (!m) return null;
      }
      const ref = _NameCache.REF;
      const pad = Math.ceil(ref * 0.35);
      const font = `${ref}px system-ui, sans-serif`;
      m.font = font;
      const w = Math.max(1, Math.ceil(m.measureText(name).width)) + pad * 2;
      const h = ref + pad * 2;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
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
  };
  _NameCache.REF = 44;
  _NameCache.measure = null;
  _NameCache.MAX_PER_FRAME = 2;
  var NameCache = _NameCache;
  var FpsSampler = class {
    constructor(size = 100) {
      this.samplerIndex = 0;
      this.size = 0;
      this.average = 0;
      this.sampler = new Float32Array(size);
    }
    reset() {
      this.samplerIndex = 0;
      this.size = 0;
      this.average = 0;
      this.sampler.fill(0);
    }
    step(fps) {
      this.sampler[this.samplerIndex] = Math.round(fps);
      this.samplerIndex = (this.samplerIndex + 1) % this.sampler.length;
      if (this.size < this.sampler.length) this.size++;
      let sum = 0;
      for (let i = 0; i < this.size; i++) sum += this.sampler[i];
      this.average = this.size ? Math.round(sum / this.size) : 0;
      return this.average;
    }
  };
  var REFRESH_LADDER = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240, 360];
  function snapRefresh(fps) {
    let best = 60, bestD = Infinity;
    for (const r of REFRESH_LADDER) {
      const d = Math.abs(r - fps);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return bestD <= best * 0.1 ? best : Math.max(30, Math.min(360, Math.round(fps)));
  }
  var Overlay = class {
    constructor(scene) {
      this.scene = scene;
      this.camera = new Camera();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.lastScale = 1;
      this.raf = 0;
      this.last = performance.now();
      this.userZoom = 1;
      this.images = new ImageCache();
      this.names = new NameCache();
      this.layers = [];
      this._food = [];
      this._viruses = [];
      this._cellPool = [];
      this._cells = [];
      this._cellMap = /* @__PURE__ */ new Map();
      this._seen = /* @__PURE__ */ new Set();
      this._foodBuckets = Array.from({ length: 64 }, () => []);
      this._cellBuckets = Array.from({ length: 64 }, () => []);
      this.fps = 0;
      this.fpsSampler = new FpsSampler(100);
      this.stalls = 0;
      this.lastStallMs = 0;
      this.detectedFps = 0;
      this._rawLast = performance.now();
      this._rawDeltas = [];
      this._rawIdx = 0;
      this._sinceEstimate = 0;
      this.drawMs = 0;
      this.dbgCells = 0;
      this.dbgFood = 0;
      this.dbgNodes = 0;
      this.visible = true;
      this.disposed = false;
      this.menuPoll = 0;
      this.menuOpen = false;
      this.loop = () => {
        if (this.disposed) return;
        this.raf = requestAnimationFrame(this.loop);
        const now = performance.now();
        const raw = now - this._rawLast;
        this._rawLast = now;
        if (raw >= 100 && raw < 2e3) {
          this.stalls++;
          this.lastStallMs = Math.round(raw);
        }
        if (raw > 0 && raw < 100) {
          const buf = this._rawDeltas;
          if (buf.length < 180) buf.push(raw);
          else {
            buf[this._rawIdx] = raw;
            this._rawIdx = (this._rawIdx + 1) % 180;
          }
        }
        if (++this._sinceEstimate >= 60) {
          this._sinceEstimate = 0;
          this.estimateRefresh();
        }
        if (++this.menuPoll >= 20) {
          this.menuPoll = 0;
          this.menuOpen = !!document.querySelector(".agx-overlay.agx-open");
        }
        let threshold = 0;
        if (settings.game.autoFps && this.detectedFps > 0) threshold = 1e3 / this.detectedFps * 0.75;
        if (settings.game.maxFps > 0) threshold = Math.max(threshold, 1e3 / settings.game.maxFps - 0.4);
        if (this.menuOpen) threshold = Math.max(threshold, 1e3 / 60 - 0.4);
        if (threshold > 0 && now - this.last < threshold) return;
        if ((settings.game.renderScale || 1) !== this.lastScale) this.resize();
        const dt = Math.min((now - this.last) / 1e3, 0.1);
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
      this._miniCanvas = null;
      this._miniCtx = null;
      this._miniAt = 0;
      this._miniSize = 0;
      this.canvas = document.createElement("canvas");
      Object.assign(this.canvas.style, {
        position: "fixed",
        left: "0",
        top: "0",
        zIndex: "2147483640",
        pointerEvents: "none"
      });
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
        { passive: true }
      );
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          this._rawDeltas.length = 0;
          this._rawIdx = 0;
          this._rawLast = performance.now();
        }
      });
      document.documentElement.appendChild(this.canvas);
      this.loop.__hsloKeep = true;
      this.raf = requestAnimationFrame(this.loop);
    }
    setVisible(v) {
      this.visible = v;
      this.canvas.style.display = v ? "block" : "none";
    }
    snapCamera() {
      this.camera.snap();
    }
    screenToWorld(sx, sy) {
      return this.camera.screenToWorld(sx, sy);
    }
    dispose() {
      this.disposed = true;
      cancelAnimationFrame(this.raf);
      this.canvas.remove();
    }
    resize() {
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
    estimateRefresh() {
      var _a;
      const buf = this._rawDeltas;
      if (buf.length < 30) return;
      const votes = /* @__PURE__ */ new Map();
      for (let i = 1; i < buf.length; i++) {
        const d = buf[i];
        if (d < 2 || d > 100) continue;
        if (Math.abs(d - buf[i - 1]) > d * 0.25) continue;
        const hz = snapRefresh(1e3 / d);
        votes.set(hz, ((_a = votes.get(hz)) != null ? _a : 0) + 1);
      }
      let best = 0, bestN = 0;
      for (const [hz, n] of votes) {
        if (n > bestN) {
          best = hz;
          bestN = n;
        }
      }
      if (best > 0) this.detectedFps = best;
    }
    frameCamera() {
      const t = this.scene.cameraTarget();
      if (!t) return;
      const base = this.camera.viewportH / 1080 * 0.32 * this.userZoom;
      let scale;
      let maxView;
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
    draw(time) {
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
        H / 2 - this.camera.y * this.camera.scale * this.dpr
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
      const food = this._food;
      let foodN = 0;
      const viruses = this._viruses;
      let virusN = 0;
      const cellPool = this._cellPool;
      let cellN = 0;
      const cellMap = this._cellMap;
      cellMap.clear();
      const seen = this._seen;
      seen.clear();
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
          if (time - n.born < 2e3 && Math.abs(n.born - layer.world.spawnFxAt) < 400 && own.has(n.id)) cullR = r * 31;
          if (x + cullR < vMinX || x - cullR > vMaxX || y + cullR < vMinY || y - cullR > vMaxY) continue;
          if (n.isVirus) {
            if (seen.has(n.id)) continue;
            seen.add(n.id);
            let v = viruses[virusN];
            if (!v) v = viruses[virusN] = { n, x, y, r, outline: null, skin: "", mine: false, virus: true, fx: false };
            else {
              v.n = n;
              v.x = x;
              v.y = y;
              v.r = r;
              v.outline = null;
              v.skin = "";
              v.mine = false;
              v.virus = true;
              v.fx = false;
            }
            virusN++;
          } else if (!n.name && n.rsize < 40) {
            if (!drawFood || seen.has(n.id)) continue;
            seen.add(n.id);
            let f = food[foodN];
            if (!f) f = food[foodN] = { n, x, y, r };
            else {
              f.n = n;
              f.x = x;
              f.y = y;
              f.r = r;
            }
            foodN++;
          } else {
            const mine = own.has(n.id);
            const prev = cellMap.get(n.id);
            if (prev && prev.mine && !mine) continue;
            const outline = mine ? layer.active ? theme.activeOutline : theme.inactiveOutline : null;
            let skin = "";
            if (mine && theme.customSkins) skin = prof.skins[boxIdx] || prof.skins.find((s) => !!s) || "";
            if (!skin && !mine && n.name) skin = this.scene.sharedSkin(n.name);
            if (!skin && theme.gameSkins && n.skinUrl) skin = n.skinUrl;
            const fx = mine && Math.abs(n.born - layer.world.spawnFxAt) < 400 && time - n.born < 2e3;
            if (prev) {
              prev.n = n;
              prev.x = x;
              prev.y = y;
              prev.r = r;
              prev.outline = outline;
              prev.skin = skin;
              prev.mine = mine;
              prev.fx = fx;
            } else {
              let c = cellPool[cellN];
              if (!c) c = cellPool[cellN] = { n, x, y, r, outline, skin, mine, virus: false, fx };
              else {
                c.n = n;
                c.x = x;
                c.y = y;
                c.r = r;
                c.outline = outline;
                c.skin = skin;
                c.mine = mine;
                c.virus = false;
                c.fx = fx;
              }
              cellN++;
              cellMap.set(n.id, c);
            }
          }
        }
      }
      const cells = this._cells;
      let cn = 0;
      for (const c of cellMap.values()) cells[cn++] = c;
      for (let i = 0; i < virusN; i++) cells[cn++] = viruses[i];
      cells.length = cn;
      cells.sort((a, b) => a.r - b.r);
      if (foodN > MAX_FOOD) {
        food.length = foodN;
        food.sort((a, b) => b.r - a.r);
        foodN = MAX_FOOD;
      }
      this.dbgCells = Math.min(cn, MAX_CELLS);
      this.dbgFood = foodN;
      let nn = 0;
      for (let i = 0; i < layers.length; i++) nn += layers[i].world.nodes.size;
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
          const key = f.n.r >> 6 << 4 | f.n.g >> 6 << 2 | f.n.b >> 6;
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
        for (let i = 0; i < foodN; i++) {
          const f = food[i];
          this.drawDisc(f.n, f.x, f.y, f.r, "");
        }
      }
      const start2 = Math.max(0, cells.length - MAX_CELLS);
      const cscale = this.camera.scale;
      let flatCount = 0;
      for (let i = start2; i < cells.length; i++) {
        const c = cells[i];
        if (!c.virus && !c.outline && !c.skin) flatCount++;
      }
      const flatToBatch = Math.max(0, flatCount - FULL_BUDGET);
      const cbuckets = this._cellBuckets;
      for (let k = 0; k < cbuckets.length; k++) cbuckets[k].length = 0;
      let flatSeen = 0, batched = false;
      for (let i = start2; i < cells.length; i++) {
        const c = cells[i];
        if (c.virus || c.outline || c.skin) continue;
        const dot = c.r * cscale <= 6 || flatSeen < flatToBatch;
        flatSeen++;
        if (!dot) continue;
        cbuckets[c.n.r >> 6 << 4 | c.n.g >> 6 << 2 | c.n.b >> 6].push(c);
        batched = true;
      }
      if (batched) {
        for (let k = 0; k < cbuckets.length; k++) {
          const b = cbuckets[k];
          if (!b.length) continue;
          ctx.beginPath();
          for (let i = 0; i < b.length; i++) {
            const c = b[i];
            ctx.moveTo(c.x + c.r, c.y);
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          }
          ctx.fillStyle = FOOD_BUCKET_COLORS[k];
          ctx.fill();
        }
      }
      flatSeen = 0;
      for (let i = start2; i < cells.length; i++) {
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
    drawBackground(theme, b) {
      if (!theme.backgroundUrl) return;
      const img = this.images.get(theme.backgroundUrl);
      if (!img) return;
      this.ctx.globalAlpha = 0.5;
      this.ctx.drawImage(img, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      this.ctx.globalAlpha = 1;
    }
    drawGrid(b) {
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
      for (let x = x0; x <= x1; x += step) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y += step) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
    }
    drawBorder(theme, b, time) {
      const ctx = this.ctx;
      ctx.lineWidth = 10 / this.camera.scale;
      ctx.strokeStyle = theme.animatedBorder ? `hsl(${time / 30 % 360}, 70%, 55%)` : "rgba(255,80,80,0.55)";
      ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    }
    drawDisc(n, x, y, r, pelletColor) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = pelletColor || n.css;
      ctx.fill();
    }
    drawCell(n, x, y, r, outline, skin, theme, time, fx) {
      const ctx = this.ctx;
      const rpx = r * this.camera.scale;
      if (theme.spawnEffects && fx && rpx > 3) {
        const age = time - n.born;
        if (age >= 0 && age < 1800) {
          const t01 = age / 1800;
          const color = outline != null ? outline : "#67e8f9";
          ctx.beginPath();
          ctx.arc(x, y, r * (1 + 30 * t01), 0, Math.PI * 2);
          ctx.lineWidth = Math.max(16 / this.camera.scale, r * 0.6) * (1 - t01) + 1e-3;
          ctx.globalAlpha = 0.9 * (1 - t01);
          ctx.strokeStyle = color;
          ctx.stroke();
          const t2 = Math.max(0, t01 - 0.15);
          ctx.beginPath();
          ctx.arc(x, y, r * (1 + 20 * t2), 0, Math.PI * 2);
          ctx.lineWidth = Math.max(8 / this.camera.scale, r * 0.25) * (1 - t2) + 1e-3;
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
        ctx.strokeStyle = outline != null ? outline : "rgba(0,0,0,0.22)";
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
    drawVirus(n, x, y, r) {
      const ctx = this.ctx;
      const spikes = 28;
      const outer = r;
      const inner = r * 0.9;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r2 = i % 2 === 0 ? outer : inner;
        const a = Math.PI * i / spikes;
        const px = x + Math.cos(a) * r2;
        const py = y + Math.sin(a) * r2;
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
    drawMinimap(b, layers, time) {
      var _a;
      const ctx = this.ctx;
      const size = Math.round(150 * this.dpr);
      const pad = 12 * this.dpr;
      const x0 = this.canvas.width - size - pad;
      const y0 = this.canvas.height - size - pad;
      const W = b.maxX - b.minX || 1;
      const H = b.maxY - b.minY || 1;
      if (!this._miniCanvas || this._miniSize !== size) {
        const c = (_a = this._miniCanvas) != null ? _a : this._miniCanvas = document.createElement("canvas");
        c.width = c.height = size;
        this._miniCtx = c.getContext("2d");
        this._miniSize = size;
        this._miniAt = 0;
      }
      const mctx = this._miniCtx;
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
            if (n.isVirus || !n.name && n.rsize < 40 || own.has(n.id)) continue;
            const px = (n.rx - scrX - b.minX) / W * size;
            const py = (n.ry - scrY - b.minY) / H * size;
            mctx.fillRect(px - 1, py - 1, 2, 2);
          }
        }
      }
      ctx.drawImage(this._miniCanvas, x0, y0);
      const sx = (wx) => x0 + (wx - b.minX) / W * size;
      const sy = (wy) => y0 + (wy - b.minY) / H * size;
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
  };

  // src/packetlog.ts
  var td = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
  function cstrAt(dv, o) {
    const bytes = [];
    let i = o;
    for (; i < dv.byteLength; i++) {
      const c = dv.getUint8(i);
      if (c === 0) {
        i++;
        break;
      }
      bytes.push(c);
    }
    const s = td ? td.decode(new Uint8Array(bytes)) : String.fromCharCode(...bytes);
    return { s, next: i };
  }
  function describe(dir, buf) {
    if (!buf.byteLength) return "(empty)";
    const dv = new DataView(buf);
    const op = dv.getUint8(0);
    const len = buf.byteLength;
    const u32 = (o) => o + 4 <= len ? dv.getUint32(o, true) : 0;
    const i32 = (o) => o + 4 <= len ? dv.getInt32(o, true) : 0;
    if (dir === "<") {
      switch (op) {
        case 16:
          try {
            const e = decodeServer(buf);
            if (e.t === "world") return `UPDATE-NODES eats=${e.world.eats.length} nodes=${e.world.updates.length} removes=${e.world.removes.length}`;
          } catch {
          }
          return "UPDATE-NODES (?)";
        case 32: {
          const ids = [];
          for (let o = 1; o + 4 <= len; o += 4) ids.push(u32(o));
          return `OWN-CELL id=${ids.join(",")}`;
        }
        case 64: {
          const b = (o) => o + 8 <= len ? dv.getFloat64(o, true) : 0;
          const gm = len > 33 ? cstrAt(dv, 33).s : "";
          return `BORDER [${b(1) | 0},${b(9) | 0},${b(17) | 0},${b(25) | 0}]${gm ? ` "${gm}"` : ""}`;
        }
        case 49:
          try {
            const e = decodeServer(buf);
            if (e.t === "leaderboard") {
              const names = e.entries.map((x) => x.name || "-");
              return `LEADERBOARD ${e.entries.length}: ${names.slice(0, 6).join(", ")}${names.length > 6 ? " ..." : ""}`;
            }
          } catch {
          }
          return "LEADERBOARD";
        case 20:
          return "CLEAR-NODES";
        case 98: {
          const r = dv.getUint8(2), g = dv.getUint8(3), b = dv.getUint8(4);
          const name = cstrAt(dv, 5);
          const text = cstrAt(dv, name.next);
          return `CHAT [${r},${g},${b}] ${name.s}: "${text.s}"`;
        }
        case 254:
          return len > 1 && dv.getUint8(1) === 123 ? `STATUS ${cstrAt(dv, 1).s.slice(0, 140)}` : `op254 (${len}B)`;
        default:
          return `op${op} (${len}B)`;
      }
    }
    switch (op) {
      case 254:
        return len === 5 ? `SET-PROTOCOL v${u32(1)}` : "PING";
      case 255:
        return `HANDSHAKE key=${u32(1)} nick="${cstrAt(dv, 5).s}"`;
      case 20:
        return `SPAWN ${cstrAt(dv, 1).s}`;
      case 5:
        return len >= 21 ? `MOVE(f64) x=${dv.getFloat64(1, true) | 0} y=${dv.getFloat64(9, true) | 0}` : `MOVE x=${i32(1)} y=${i32(5)}`;
      case 0:
        return `SPAWN-LEGACY(op0) "${cstrAt(dv, 1).s}"  [wrong opcode for this server]`;
      case 1:
        return "SPECTATE(op1)";
      case 15:
        return `CLIENT-15 (split/eject?) ${len}B`;
      case 18:
        return `CLIENT-18 (split/eject?) ${len}B`;
      case 17:
        return "SPLIT(op17?)";
      case 21:
        return "EJECT(op21?)";
      default:
        return `op${op} (${len}B)`;
    }
  }
  var PacketLog = class {
    constructor() {
      this.recs = [];
      this.counts = /* @__PURE__ */ new Map();
      this.cap = 4e3;
      this.enabled = false;
    }
    setEnabled(v) {
      this.enabled = v;
      if (!v) this.recs.length = 0;
    }
    add(dir, buf) {
      var _a;
      if (!buf || !buf.byteLength) return;
      const op = new Uint8Array(buf)[0];
      const key = `${dir}${op}`;
      const c = ((_a = this.counts.get(key)) != null ? _a : 0) + 1;
      this.counts.set(key, c);
      if (!this.enabled) return;
      if ((op === 16 || op === 5 || op === 49 || op === 254) && c > 8 && c % 250 !== 0) return;
      this.recs.push({ t: Date.now(), dir, op, len: buf.byteLength, buf: buf.slice(0, 1024) });
      if (this.recs.length > this.cap) this.recs.shift();
    }
    summary() {
      return [...this.counts.entries()].sort().map(([k, v]) => `${k}x${v}`).join("  ");
    }
    line(r) {
      const ts = new Date(r.t).toISOString().slice(11, 23);
      return `${ts} ${r.dir} ${describe(r.dir, r.buf)}`;
    }
    tail(n) {
      return this.recs.slice(-n).map((r) => this.line(r));
    }
    dump() {
      const head = `=== agarv2mod packet log (${this.recs.length} recs) - LIVE OgarII opcode map ===
legend: > game sent - >* we sent - < server received
client ops: 254=set-protocol 255=handshake 20=SPAWN(+token) 5=MOVE  -  server: 16=nodes 32=own-cell 64=border 49=leaderboard 98=chat 254=status
summary: ${this.summary()}
`;
      const body = this.recs.map((r) => `${this.line(r)}   ${hex(r.buf, 48)}`).join("\n");
      return `${head}
${body}`;
    }
  };

  // src/skinshare.ts
  var MARKER = "~hsk~";
  var TTL_MS = 6e4;
  var SkinShare = class {
    constructor() {
      this.map = /* @__PURE__ */ new Map();
      this.seq = 0;
    }
    encode(nick, url) {
      const nonce = (this.seq = this.seq + 1 & 65535).toString(36);
      return `${MARKER}${nonce} ${url} ${nick}`;
    }
    isMarker(message) {
      return message.startsWith(MARKER);
    }
    ingest(message) {
      if (!message.startsWith(MARKER)) return false;
      const body = message.slice(MARKER.length);
      const i1 = body.indexOf(" ");
      if (i1 < 0) return true;
      const i2 = body.indexOf(" ", i1 + 1);
      if (i2 < 0) return true;
      const url = body.slice(i1 + 1, i2).trim();
      const nick = body.slice(i2 + 1);
      if (url) this.map.set(nick, { url, t: Date.now() });
      else this.map.delete(nick);
      return true;
    }
    get(nick) {
      const e = this.map.get(nick);
      if (!e) return "";
      if (Date.now() - e.t > TTL_MS) {
        this.map.delete(nick);
        return "";
      }
      return e.url;
    }
    get size() {
      return this.map.size;
    }
  };

  // src/ui/styles.ts
  var CSS = `
.agx-root, .agx-hud { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #e2e8f0; }
.agx-overlay {
  position: fixed; inset: 0; z-index: 2147483646; display: none;
  align-items: center; justify-content: center;
  background: rgba(10,10,18,0.7); backdrop-filter: blur(3px);
}
.agx-overlay.agx-open { display: flex; }
.agx-card {
  width: min(960px, 94vw); height: min(640px, 92vh); padding: 26px; border-radius: 24px;
  background: linear-gradient(180deg,#151527,#0e0e1a); border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 25px 80px -20px rgba(34,211,238,0.3); box-sizing: border-box; position: relative;
  display: flex; flex-direction: column; align-items: center;
}
.agx-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; width: 100%; max-width: 1040px; }
.agx-body::-webkit-scrollbar { width: 8px; }
.agx-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }
.agx-title { margin: 0; text-align: center; font-size: 44px; font-weight: 900; letter-spacing: -1px;
  background: linear-gradient(90deg,#67e8f9,#38bdf8,#818cf8); -webkit-background-clip: text; background-clip: text; color: transparent; }
.agx-sub { margin: 2px 0 18px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.45); }
.agx-label { font-size: 11px; letter-spacing: 1px; color: rgba(255,255,255,0.4); margin: 12px 0 6px; }

.agx-game { display: flex; gap: 26px; align-items: stretch; flex-wrap: wrap; }
.agx-game-left { flex: 7 1 340px; display: flex; flex-direction: column; justify-content: center; }
.agx-game-right { flex: 3 1 220px; position: relative; }
.agx-nick { text-align: center; font-size: 18px; }
.agx-playrow { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
.agx-play { padding: 15px; border: none; border-radius: 14px; cursor: pointer;
  font: 800 18px system-ui; color: #06121a; background: linear-gradient(90deg,#22d3ee,#0ea5e9);
  box-shadow: 0 14px 40px -14px rgba(34,211,238,0.8); }
.agx-play:hover { background: linear-gradient(90deg,#67e8f9,#38bdf8); }
.agx-spectate { padding: 15px; border-radius: 14px; cursor: pointer; font: 800 18px system-ui;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #e2e8f0; }
.agx-spectate:hover { border-color: rgba(34,211,238,0.5); background: rgba(34,211,238,0.08); color: #fff; }

.agx-pcircles { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
.agx-pcircle { aspect-ratio: 1 / 1; border-radius: 50%; cursor: pointer; position: relative; overflow: hidden;
  border: 2px solid rgba(255,255,255,0.12); background-size: cover; background-position: center;
  background-color: rgba(255,255,255,0.05); color: #cbd5e1; font: 700 14px system-ui;
  display: flex; align-items: center; justify-content: center; }
.agx-pcircle:hover { border-color: rgba(255,255,255,0.3); }
.agx-pcircle.agx-sel { border-color: rgba(34,211,238,0.85); box-shadow: 0 0 18px -4px rgba(34,211,238,0.7); }
.agx-pcircle.agx-has-skin { color: transparent; }

.agx-skinpop { position: absolute; z-index: 5; left: 0; right: 0; top: 22px;
  background: linear-gradient(180deg,#1a1a30,#12121f); border: 1px solid rgba(34,211,238,0.35);
  border-radius: 14px; padding: 14px; box-shadow: 0 24px 60px -18px rgba(0,0,0,0.85); }
.agx-skinpop-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
  font: 700 13px system-ui; color: #a5f3fc; }
.agx-skinpop .agx-x { position: static; width: 24px; height: 24px; }

.agx-input { width: 100%; box-sizing: border-box; padding: 11px 14px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.4); color: #fff; font: 15px system-ui; }
.agx-input:focus { outline: none; border-color: rgba(34,211,238,0.5); }
.agx-skin { margin-bottom: 8px; font-size: 13px; padding: 9px 12px; }

.agx-tabs { display: flex; gap: 4px; padding: 4px; margin-bottom: 18px; border-radius: 12px; background: rgba(0,0,0,0.4); width: 100%; max-width: 1040px; box-sizing: border-box; }
.agx-tab { flex: 1; padding: 9px; border-radius: 9px; border: none; cursor: pointer; font: 600 13px system-ui; background: transparent; color: rgba(255,255,255,0.6); white-space: nowrap; }
.agx-tab.agx-on { background: linear-gradient(90deg,#22d3ee,#0ea5e9); color: #06121a; }
.agx-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 2px; border-bottom: 1px solid rgba(255,255,255,0.05); font: 14px system-ui; color: #cbd5e1; }
.agx-seg { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: rgba(0,0,0,0.4); }
.agx-seg button { flex: 1; padding: 7px 10px; border: none; border-radius: 8px; cursor: pointer; font: 600 12px system-ui; background: transparent; color: rgba(255,255,255,0.6); white-space: nowrap; }
.agx-seg button.agx-on { background: rgba(34,211,238,0.25); color: #a5f3fc; }
.agx-switch { width: 36px; height: 21px; border-radius: 11px; background: rgba(255,255,255,0.15); position: relative; cursor: pointer; transition: background .15s; flex: none; }
.agx-switch.agx-on { background: #22d3ee; }
.agx-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: transform .15s; }
.agx-switch.agx-on::after { transform: translateX(15px); }
.agx-keybtn { min-width: 84px; border: 1px solid rgba(255,255,255,0.15); border-radius: 7px; padding: 5px 10px; cursor: pointer;
  font: 13px ui-monospace, monospace; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.04); }
.agx-keybtn.agx-cap { border-color: #22d3ee; background: rgba(34,211,238,0.2); color: #a5f3fc; }
.agx-btn { width: 100%; padding: 11px; margin-top: 10px; border-radius: 12px; cursor: pointer; font: 700 14px system-ui;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: #cbd5e1; }
.agx-btn:hover { border-color: rgba(34,211,238,0.4); }
.agx-x { position: absolute; top: 16px; right: 16px; width: 30px; height: 30px; border: none; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); font-size: 16px; }
.agx-slider { width: 150px; }
.agx-color { width: 40px; height: 26px; border: none; background: none; padding: 0; cursor: pointer; }
.agx-note { font-size: 11px; color: rgba(255,255,255,0.4); margin: 6px 0; }

.agx-hud { position: fixed; z-index: 2147483645; pointer-events: none; }
.agx-stats { left: 12px; bottom: 12px; font: 12px ui-monospace, monospace; color: #e2e8f0;
  background: rgba(10,10,18,0.72); padding: 7px 11px; border-radius: 10px; }
.agx-stats b { font-size: 15px; }
.agx-boxbar { left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; gap: 8px; align-items: center; }
.agx-chip { min-width: 34px; height: 30px; padding: 0 10px; display: flex; align-items: center; justify-content: center;
  border-radius: 9px; font-weight: 700; border: 2px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.4); color: rgba(255,255,255,0.5); }
.agx-hint { font-size: 11px; color: rgba(255,255,255,0.45); margin-left: 6px; }
.agx-lb { right: 12px; top: 12px; width: 190px; background: rgba(10,10,18,0.72); padding: 8px 11px; border-radius: 12px; font: 13px system-ui; }
.agx-lb-h { text-align: center; font-weight: 700; margin-bottom: 5px; color: #94a3b8; }
.agx-lb-row { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #e2e8f0; line-height: 1.5; }
.agx-lb-row.agx-me { color: #67e8f9; font-weight: 700; }
.agx-banner { left: 50%; top: 12px; transform: translateX(-50%); background: rgba(34,211,238,0.92); color: #03121a;
  font: 600 13px system-ui; padding: 8px 14px; border-radius: 10px; }
.agx-log { left: 12px; top: 84px; max-width: 46vw; white-space: pre; font: 11px/1.4 ui-monospace, monospace; color: #9effa0;
  background: rgba(0,0,0,0.7); padding: 6px 9px; border-radius: 8px; }
.agx-copybtn { left: 12px; top: 11px; pointer-events: auto; cursor: pointer; border: none; border-radius: 8px;
  padding: 7px 11px; background: rgba(34,211,238,0.9); color: #03121a; font: 700 12px system-ui; }
.agx-copybtn:hover { background: #67e8f9; }
.agx-chat { left: 12px; bottom: 58px; width: 300px; max-width: 40vw; display: flex; flex-direction: column; gap: 5px; }
.agx-chat-msgs { max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
  font: 12px/1.35 system-ui; pointer-events: auto; padding-right: 5px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.25) transparent; }
.agx-chat-msgs::-webkit-scrollbar { width: 7px; }
.agx-chat-msgs::-webkit-scrollbar-track { background: transparent; }
.agx-chat-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 7px; }
.agx-chat-msgs::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45); }
.agx-chat-line { color: #e2e8f0; text-shadow: 0 1px 2px rgba(0,0,0,0.9); word-break: break-word; }
.agx-chat-name { font-weight: 700; }
.agx-chat-input { pointer-events: auto; width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.12); background: rgba(10,10,18,0.82); color: #fff; font: 13px system-ui; }
.agx-chat-input:focus { outline: none; border-color: rgba(34,211,238,0.6); background: rgba(10,10,18,0.95); }
`;
  var injected = false;
  function injectStyles() {
    if (injected) return;
    injected = true;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      return;
    } catch {
    }
    const s = document.createElement("style");
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function el(tag, className = "", props = {}, children = []) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    const { style, ...rest } = props;
    Object.assign(e, rest);
    if (style) e.style.cssText = style;
    for (const c of children) e.append(c);
    return e;
  }

  // src/ui/hud.ts
  function mountHud(opts) {
    const { mb: mb2, overlay: overlay2, logLines: logLines2, packets: packets2, chat: chat2, copyText: copyText2 } = opts;
    let debug = false;
    let hudVisible = true;
    const stat = el("div", "agx-hud agx-stats");
    const boxbar = el("div", "agx-hud agx-boxbar");
    const lb = el("div", "agx-hud agx-lb");
    const log2 = el("div", "agx-hud agx-log");
    const copyBtn = el("button", "agx-hud agx-copybtn", { textContent: "Copy logs", title: "Copy packet transcript + log to clipboard" });
    copyBtn.addEventListener("click", () => {
      var _a;
      const text = copyText2();
      const done = () => {
        copyBtn.textContent = "Copied";
        setTimeout(() => copyBtn.textContent = "Copy logs", 1500);
      };
      (_a = navigator.clipboard) == null ? void 0 : _a.writeText(text).then(done, () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.documentElement.append(ta);
        ta.select();
        try {
          document.execCommand("copy");
          done();
        } catch {
          copyBtn.textContent = "copy failed - see console";
          console.log(text);
        }
        ta.remove();
      });
    });
    const chatMsgs = el("div", "agx-chat-msgs");
    const chatInput = el("input", "agx-chat-input", { placeholder: "Press Enter to chat...", maxLength: 200 });
    const chatBox = el("div", "agx-hud agx-chat", {}, [chatMsgs, chatInput]);
    const submitChat = () => {
      const v = chatInput.value.trim().slice(0, 200);
      chatInput.value = "";
      if (v) mb2.sendChat(v);
      chatInput.blur();
    };
    const closeChat = () => {
      chatInput.value = "";
      chatInput.blur();
    };
    document.documentElement.append(stat, boxbar, lb, chatBox, log2, copyBtn);
    let chatRev = -1;
    const hint = () => {
      const b = settings.bindings;
      return `TAB box 2 - ${keyLabel(b.split)} split - ${keyLabel(b.eject)} eject - ${keyLabel(b.respawn)} respawn - Esc menu`;
    };
    const timer = agxInterval(() => {
      const t = settings.theme;
      const hud2 = mb2.hud();
      if (!hudVisible) {
        stat.style.display = boxbar.style.display = lb.style.display = chatBox.style.display = "none";
      } else {
        stat.style.display = t.showMass ? "block" : "none";
        if (t.showMass) {
          const fpsText = `${Math.round(overlay2.fps)}${overlay2.detectedFps ? ` / ${overlay2.detectedFps}Hz` : ""}`;
          const pingText = hud2.ping ? ` - ping: ${hud2.ping}ms` : "";
          stat.replaceChildren(
            el("div", "", {}, [el("b", "", { textContent: `Mass ${formatMass(hud2.mass, t.massFormat)}` })]),
            el("div", "", { textContent: `cells: ${hud2.cellCount} - FPS: ${fpsText}${pingText}` })
          );
        }
        boxbar.replaceChildren();
        hud2.players.forEach((p) => {
          const chip = el("div", "agx-chip", { textContent: p.label });
          const color = p.active ? t.activeOutline : "rgba(255,255,255,0.15)";
          Object.assign(chip.style, {
            borderColor: color,
            background: p.active ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.4)",
            color: p.alive ? p.active ? "#fff" : "rgba(255,255,255,0.7)" : "#ef4444",
            opacity: p.connected ? "1" : "0.4",
            textDecoration: p.alive ? "none" : "line-through"
          });
          boxbar.append(chip);
        });
        boxbar.append(el("span", "agx-hint", { textContent: hint() }));
        const rows = t.showLeaderboard ? mb2.leaderboard() : [];
        lb.style.display = rows.length ? "block" : "none";
        if (rows.length) {
          lb.replaceChildren(el("div", "agx-lb-h", { textContent: "Leaderboard" }));
          rows.slice(0, 10).forEach((e, i) => {
            lb.append(el("div", `agx-lb-row${e.id ? " agx-me" : ""}`, { textContent: `${i + 1}. ${e.name || "An unnamed cell"}` }));
          });
        }
        chatBox.style.display = t.showChat ? "flex" : "none";
        if (t.showChat && chat2.rev !== chatRev) {
          chatRev = chat2.rev;
          const atBottom = chatMsgs.scrollTop + chatMsgs.clientHeight >= chatMsgs.scrollHeight - 4;
          chatMsgs.replaceChildren(
            ...chat2.msgs.map(
              (m) => el("div", "agx-chat-line", {}, [
                el("span", "agx-chat-name", { textContent: `${m.name || "-"}: `, style: `color:${m.color}` }),
                el("span", "", { textContent: m.message })
              ])
            )
          );
          if (atBottom) chatMsgs.scrollTop = chatMsgs.scrollHeight;
        }
      }
      log2.style.display = debug ? "block" : "none";
      copyBtn.style.display = debug ? "block" : "none";
      if (debug) {
        log2.textContent = [
          `${mb2.status}`,
          `packets: ${packets2.summary() || "(none yet)"}`,
          "-- recent (decoded) --",
          ...packets2.tail(8),
          ...logLines2.slice(-3)
        ].filter(Boolean).join("\n");
      }
    }, 200);
    return {
      setDebug: (v) => {
        debug = v;
        packets2.setEnabled(v);
      },
      setVisible: (v) => {
        hudVisible = v;
        if (!v) {
          closeChat();
          chatBox.style.display = "none";
        }
      },
      focusChat: () => {
        if (settings.theme.showChat) chatInput.focus();
      },
      chatFocused: () => document.activeElement === chatInput,
      submitChat,
      closeChat,
      dispose: () => {
        clearInterval(timer);
        for (const e of [stat, boxbar, lb, chatBox, log2, copyBtn]) e.remove();
      }
    };
  }

  // src/ui/settings.ts
  var ACTIONS = Object.keys(ACTION_LABELS);
  function createSettingsTabs(rerender) {
    let capturingAction = null;
    window.addEventListener("keydown", (e) => {
      if (!capturingAction) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Backspace" || e.code === "Delete") {
        settings.bindings[capturingAction] = "";
        save();
      } else if (e.code !== "Escape") {
        settings.bindings[capturingAction] = e.code;
        save();
      }
      capturingAction = null;
      rerender();
    }, true);
    window.addEventListener("mousedown", (e) => {
      if (!capturingAction) return;
      e.preventDefault();
      e.stopPropagation();
      settings.bindings[capturingAction] = "Mouse" + e.button;
      save();
      capturingAction = null;
      rerender();
    }, true);
    function toggleRow(label, get, set) {
      const sw = el("div", `agx-switch${get() ? " agx-on" : ""}`);
      const row = el("div", "agx-row", {}, [el("span", "", { textContent: label }), sw]);
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        set(!get());
        save();
        sw.classList.toggle("agx-on", get());
      });
      return row;
    }
    function segRow(label, opts, get, set) {
      const seg = el("div", "agx-seg");
      const paint = () => Array.from(seg.children).forEach((b, i) => b.classList.toggle("agx-on", opts[i][0] === get()));
      opts.forEach(([val, text]) => {
        const b = el("button", "", { textContent: text });
        b.addEventListener("click", () => {
          set(val);
          save();
          paint();
        });
        seg.append(b);
      });
      paint();
      const row = el("div", "agx-row", {}, [el("span", "", { textContent: label })]);
      row.append(seg);
      return row;
    }
    function colorRow(label, get, set, def) {
      const input = el("input", "agx-color", { type: "color", value: get() });
      input.addEventListener("input", () => {
        set(input.value);
        save();
      });
      const reset = el("button", "agx-keybtn", { textContent: "reset" });
      reset.addEventListener("click", () => {
        set(def);
        input.value = def;
        save();
      });
      const wrap = el("div", "", { style: "display:flex;gap:6px;align-items:center" }, [input, reset]);
      return el("div", "agx-row", {}, [el("span", "", { textContent: label }), wrap]);
    }
    function render(tab, body) {
      if (tab === "game") {
        body.append(segRow(
          "Multibox camera mode",
          [["single", "Single"], ["center", "Center"]],
          () => settings.game.multiboxCamera,
          (v) => settings.game.multiboxCamera = v
        ));
        body.append(segRow(
          "Zoom",
          [["auto", "Auto-fit"], ["manual", "Manual"]],
          () => settings.game.zoomMode,
          (v) => settings.game.zoomMode = v
        ));
        body.append(el("div", "agx-note", { textContent: "Manual: scroll the mouse wheel to zoom; the camera still follows your box." }));
        body.append(toggleRow(
          "Inactive box stops at last cursor",
          () => settings.game.inactiveBoxStops,
          (v) => settings.game.inactiveBoxStops = v
        ));
        const dd = el("input", "agx-slider", { type: "range", min: "20", max: "300", value: String(settings.game.drawDelay) });
        const ddLbl = el("span", "", { textContent: `Animation delay ${settings.game.drawDelay}ms` });
        dd.addEventListener("input", () => {
          settings.game.drawDelay = Number(dd.value);
          ddLbl.textContent = `Animation delay ${dd.value}ms`;
          save();
        });
        body.append(el("div", "agx-row", {}, [ddLbl, dd]));
        body.append(el("div", "agx-note", { textContent: "How long cells take to glide to their server position. Lower = snappier, higher = smoother." }));
        body.append(toggleRow(
          "Auto FPS - match display refresh",
          () => settings.game.autoFps,
          (v) => settings.game.autoFps = v
        ));
        body.append(el("div", "agx-note", { textContent: "Measures your monitor's refresh rate and caps the overlay to it. Max FPS below still applies on top (0 = off)." }));
        const fps = el("input", "agx-keybtn", { type: "number", min: "30", max: "360", value: String(settings.game.maxFps), style: "width:70px" });
        fps.addEventListener("change", () => {
          settings.game.maxFps = Math.max(0, Math.min(360, Number(fps.value) | 0));
          save();
        });
        body.append(el("div", "agx-row", {}, [el("span", "", { textContent: "Max FPS - manual (0 = uncapped)" }), fps]));
        body.append(segRow(
          "Resolution",
          [["1", "100%"], ["0.75", "75%"], ["0.5", "50%"]],
          () => String(settings.game.renderScale === 0.5 ? 0.5 : settings.game.renderScale === 0.75 ? 0.75 : 1),
          (v) => settings.game.renderScale = Number(v)
        ));
        body.append(el("div", "agx-note", { textContent: "Lower = sharper-but-slower -> softer-but-faster. Big FPS win on high-DPI screens." }));
      } else if (tab === "controls") {
        body.append(el("div", "agx-note", { textContent: "Click a binding, then press a key or click a mouse button to set it. Backspace clears, Esc cancels." }));
        for (const a of ACTIONS) {
          const btn = el(
            "button",
            `agx-keybtn${capturingAction === a ? " agx-cap" : ""}`,
            { textContent: capturingAction === a ? "press a key / mouse..." : keyLabel(settings.bindings[a]) }
          );
          btn.addEventListener("click", () => {
            capturingAction = a;
            rerender();
          });
          body.append(el("div", "agx-row", {}, [el("span", "", { textContent: ACTION_LABELS[a] }), btn]));
        }
        const reset = el("button", "agx-btn", { textContent: "Reset to defaults" });
        reset.addEventListener("click", () => {
          settings.bindings = { ...DEFAULT_BINDINGS };
          save();
          rerender();
        });
        body.append(reset);
        body.append(el("div", "agx-note", { textContent: "Advanced - split/eject WIRE opcodes (read from the [L] packet log: -> op=N when the game splits/ejects):" }));
        const numRow = (label, get, set) => {
          const inp = el("input", "agx-keybtn", { type: "number", value: String(get()), style: "width:70px" });
          inp.addEventListener("change", () => {
            set(Math.max(0, Math.min(255, Number(inp.value) | 0)));
            save();
          });
          body.append(el("div", "agx-row", {}, [el("span", "", { textContent: label }), inp]));
        };
        numRow("Split opcode", () => settings.game.splitOp, (v) => settings.game.splitOp = v);
        numRow("Eject opcode", () => settings.game.ejectOp, (v) => settings.game.ejectOp = v);
        numRow("Chat opcode", () => settings.game.chatOp, (v) => settings.game.chatOp = v);
      } else if (tab === "theme") {
        const t = settings.theme;
        body.append(toggleRow("Animated border", () => t.animatedBorder, (v) => t.animatedBorder = v));
        body.append(toggleRow("Cell shadows", () => t.cellShadow, (v) => t.cellShadow = v));
        body.append(toggleRow("Spawn effects", () => t.spawnEffects, (v) => t.spawnEffects = v));
        body.append(toggleRow("Background grid", () => t.showGrid, (v) => t.showGrid = v));
        body.append(toggleRow("Cell names", () => t.showNames, (v) => t.showNames = v));
        body.append(toggleRow("Custom skins (your skin URL on all your cells)", () => t.customSkins, (v) => t.customSkins = v));
        body.append(toggleRow("Game skins (server-provided)", () => t.gameSkins, (v) => t.gameSkins = v));
        body.append(colorRow("Active box outline", () => t.activeOutline, (v) => t.activeOutline = v, "#ff3b30"));
        body.append(colorRow("Inactive box outline", () => t.inactiveOutline, (v) => t.inactiveOutline = v, "#ffffff"));
        body.append(segRow(
          "Ring size",
          [["thin", "Thin"], ["normal", "Normal"], ["thick", "Thick"]],
          () => t.ringSize <= 0.6 ? "thin" : t.ringSize >= 1.6 ? "thick" : "normal",
          (v) => t.ringSize = v === "thin" ? 0.5 : v === "thick" ? 2 : 1
        ));
        body.append(toggleRow("Show pellets (X) - off for FPS", () => t.showPellets, (v) => t.showPellets = v));
        body.append(segRow(
          "Pellets",
          [["game", "Game colors"], ["custom", "Custom"]],
          () => t.pelletColor ? "custom" : "game",
          (v) => t.pelletColor = v === "custom" ? t.pelletColor || "#88ccff" : ""
        ));
        body.append(colorRow("Pellet color (when Custom)", () => t.pelletColor || "#88ccff", (v) => t.pelletColor = v, "#88ccff"));
        body.append(el("div", "agx-label", { textContent: "BACKGROUND" }));
        body.append(colorRow("Background color", () => t.backgroundColor || "#0c0c16", (v) => t.backgroundColor = v, "#0c0c16"));
        const bg = el("input", "agx-input agx-skin", { value: t.backgroundUrl, placeholder: "Background image URL (optional)" });
        bg.addEventListener("input", () => {
          t.backgroundUrl = bg.value.trim();
          save();
        });
        body.append(bg);
        body.append(el("div", "agx-label", { textContent: "HUD" }));
        body.append(toggleRow("Minimap", () => t.showMinimap, (v) => t.showMinimap = v));
        body.append(toggleRow("Leaderboard", () => t.showLeaderboard, (v) => t.showLeaderboard = v));
        body.append(toggleRow("Mass / stats", () => t.showMass, (v) => t.showMass = v));
        body.append(segRow(
          "Mass format",
          [["auto", "Auto"], ["short", "Short"], ["full", "Full"]],
          () => t.massFormat,
          (v) => t.massFormat = v
        ));
        body.append(toggleRow("Kill feed", () => t.showKillFeed, (v) => t.showKillFeed = v));
        body.append(toggleRow("Chat", () => t.showChat, (v) => t.showChat = v));
      } else {
        const exp = el("button", "agx-btn", { textContent: "Export settings (.hsf.json)" });
        exp.addEventListener("click", () => {
          const blob = new Blob([exportJson()], { type: "application/json" });
          const a = el("a", "", { href: URL.createObjectURL(blob), download: "hslo-agarv2mod.hsf.json" });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
        });
        const file = el("input", "", { type: "file", accept: ".json,.hsf,application/json", style: "display:none" });
        file.addEventListener("change", () => {
          var _a;
          const f = (_a = file.files) == null ? void 0 : _a[0];
          if (!f) return;
          f.text().then((txt) => {
            if (!importJson(txt)) alert("Import failed: invalid settings file");
            else rerender();
          });
        });
        const imp = el("button", "agx-btn", { textContent: "Import settings..." });
        imp.addEventListener("click", () => file.click());
        body.append(exp, imp, file);
      }
    }
    return { render, capturing: () => capturingAction !== null };
  }

  // src/ui/menu.ts
  var PANEL_WIDTH = "min(960px, 94vw)";
  var PANEL_HEIGHT = "min(640px, 65vh)";
  var PANEL_RADIUS = "24px";
  var TABS = [
    ["play", "Game"],
    ["game", "Settings"],
    ["controls", "Controls"],
    ["theme", "Theme"],
    ["data", "Data"]
  ];
  function mountMenu(mb2) {
    const card = el("div", "agx-card", { style: `width:${PANEL_WIDTH};height:${PANEL_HEIGHT};border-radius:${PANEL_RADIUS}` });
    const overlay2 = el("div", "agx-overlay", {}, [card]);
    overlay2.addEventListener("click", (e) => {
      if (e.target === overlay2) close();
    });
    document.documentElement.appendChild(overlay2);
    const settingsTabs = createSettingsTabs(() => render());
    let tab = "play";
    let skinPopFor = null;
    const setOpen = (v) => overlay2.classList.toggle("agx-open", v);
    const isOpen = () => overlay2.classList.contains("agx-open");
    const open = (t) => {
      if (t) tab = t;
      skinPopFor = null;
      render();
      setOpen(true);
    };
    const close = () => setOpen(false);
    const toggle = () => isOpen() ? close() : open();
    const prof = () => settings.profiles[settings.selected];
    function doPlay() {
      save();
      mb2.play();
      close();
    }
    function doSpectate() {
      mb2.spectate();
      close();
    }
    function applySkinBg(c, p) {
      const skin = (p.skins.find((s) => !!s) || "").trim();
      if (skin) {
        c.classList.add("agx-has-skin");
        c.style.backgroundImage = `url("${skin.replace(/"/g, "%22")}")`;
      } else {
        c.classList.remove("agx-has-skin");
        c.style.backgroundImage = "";
      }
    }
    function renderSkinPop(i, circleEl) {
      var _a;
      const p = settings.profiles[i];
      const pop = el("div", "agx-skinpop");
      const x = el("button", "agx-x", { textContent: "x" });
      x.addEventListener("click", () => {
        skinPopFor = null;
        render();
      });
      pop.append(el("div", "agx-skinpop-h", {}, [el("span", "", { textContent: `${p.name || `Profile ${i + 1}`} skins` }), x]));
      for (let box = 0; box < DEFAULT_BOX_COUNT; box++) {
        const inp = el("input", "agx-input agx-skin", { value: (_a = p.skins[box]) != null ? _a : "", placeholder: `Box ${box + 1} skin URL` });
        inp.addEventListener("input", () => {
          p.skins[box] = inp.value.trim();
          save();
          if (circleEl) applySkinBg(circleEl, p);
        });
        pop.append(inp);
      }
      return pop;
    }
    function renderPlay(body) {
      var _a;
      const game = el("div", "agx-game");
      const circleEls = [];
      const left = el("div", "agx-game-left");
      left.append(el("h1", "agx-title", { textContent: "Agar.io" }));
      left.append(el("p", "agx-sub", { textContent: "Standalone multibox client - Play & Spectate" }));
      left.append(el("div", "agx-label", { textContent: "NICKNAME", style: "text-align:center" }));
      const nick = el("input", "agx-input agx-nick", { value: prof().name, placeholder: "An unnamed cell", maxLength: 15 });
      nick.addEventListener("input", () => {
        prof().name = nick.value.slice(0, 15);
        save();
      });
      nick.addEventListener("change", () => {
        prof().name = nick.value.slice(0, 15);
        save();
        mb2.refreshChatNick();
      });
      nick.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doPlay();
      });
      left.append(nick);
      left.append(el("div", "agx-label", { textContent: "SKINS - image URL per box", style: "text-align:center" }));
      for (let box = 0; box < DEFAULT_BOX_COUNT; box++) {
        const skin = el("input", "agx-input agx-skin", { value: (_a = prof().skins[box]) != null ? _a : "", placeholder: `Box ${box + 1} skin URL` });
        skin.addEventListener("input", () => {
          prof().skins[box] = skin.value.trim();
          save();
          const c = circleEls[settings.selected];
          if (c) applySkinBg(c, prof());
        });
        left.append(skin);
      }
      const playRow = el("div", "agx-playrow");
      const play = el("button", "agx-play", { textContent: "Play" });
      play.addEventListener("click", doPlay);
      const spec = el("button", "agx-spectate", { textContent: "Spectate" });
      spec.addEventListener("click", doSpectate);
      playRow.append(play, spec);
      left.append(playRow);
      const right = el("div", "agx-game-right");
      right.append(el("div", "agx-label", { textContent: "PROFILES" }));
      const circles = el("div", "agx-pcircles");
      settings.profiles.forEach((p, i) => {
        const c = el(
          "button",
          `agx-pcircle${i === settings.selected ? " agx-sel" : ""}`,
          { textContent: p.name ? p.name[0].toUpperCase() : String(i + 1) }
        );
        applySkinBg(c, p);
        c.addEventListener("click", () => {
          settings.selected = i;
          save();
          skinPopFor = skinPopFor === i ? null : i;
          render();
        });
        circleEls.push(c);
        circles.append(c);
      });
      right.append(circles);
      if (skinPopFor !== null) right.append(renderSkinPop(skinPopFor, circleEls[skinPopFor]));
      game.append(left, right);
      body.append(game);
    }
    function render() {
      card.replaceChildren();
      const tabBar = el("div", "agx-tabs");
      for (const [t, label] of TABS) {
        const b = el("button", `agx-tab${t === tab ? " agx-on" : ""}`, { textContent: label });
        b.addEventListener("click", () => {
          tab = t;
          skinPopFor = null;
          render();
        });
        tabBar.append(b);
      }
      card.append(tabBar);
      const body = el("div", "agx-body");
      card.append(body);
      if (tab === "play") renderPlay(body);
      else settingsTabs.render(tab, body);
    }
    return { open, close, toggle, isOpen, capturing: () => settingsTabs.capturing(), dispose: () => overlay2.remove() };
  }

  // src/main.ts
  var logLines = [];
  function log(...args) {
    logLines.push(
      args.map((a) => typeof a === "string" ? a : safeJson(a)).join(" ")
    );
    if (logLines.length > 30) logLines.shift();
    console.log(...args);
  }
  function safeJson(v) {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  var packets = new PacketLog();
  var chat = new ChatLog();
  var skinShare = new SkinShare();
  var mb = new Multibox(log, skinShare, chat);
  var overlay = null;
  var menu = null;
  var hud = null;
  var debugOpen = false;
  var wired = false;
  function copyText() {
    return `${packets.dump()}

=== text log ===
${logLines.join("\n")}`;
  }
  function start() {
    if (overlay) return;
    injectStyles();
    overlay = new Overlay(mb);
    mb.attachOverlay(overlay);
    menu = mountMenu(mb);
    hud = mountHud({
      mb,
      overlay,
      logLines,
      packets,
      chat,
      copyText
    });
    debugOpen = false;
    hud.setDebug(false);
    mb.onAllDead = () => menu == null ? void 0 : menu.open();
    menu.open();
    if (!wired) {
      wired = true;
      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keyup", onKeyUp, true);
      window.addEventListener("mousedown", onMouseDown, true);
      window.addEventListener("mouseup", onMouseUp, true);
      window.addEventListener("contextmenu", (e) => {
        if (!(menu == null ? void 0 : menu.isOpen()) && bindingFor("Mouse2")) e.preventDefault();
      }, true);
    }
  }
  async function boot() {
    if (overlay && document.documentElement.contains(overlay.canvas)) return;
    if (!document.body) return;
    if (overlay) {
      try {
        overlay.dispose();
      } catch {
      }
      try {
        hud == null ? void 0 : hud.dispose();
      } catch {
      }
      try {
        menu == null ? void 0 : menu.dispose();
      } catch {
      }
      overlay = null;
      menu = null;
      hud = null;
      log("[agarv2mod] UI detached - remounting");
    }
    try {
      await ensureFp2();
      start();
    } catch (e) {
      overlay = null;
      console.error("[agarv2mod] boot failed:", e);
    }
  }
  window.addEventListener("load", () => void boot());
  document.addEventListener("readystatechange", () => void boot());
  agxInterval(() => void boot(), 500);
  void boot();
  function bindingFor(code) {
    return Object.keys(settings.bindings).find(
      (k) => settings.bindings[k] === code
    );
  }
  function onKeyDown(e) {
    if (menu == null ? void 0 : menu.capturing()) return;
    if (hud == null ? void 0 : hud.chatFocused()) {
      e.stopImmediatePropagation();
      if (e.code === "Enter") {
        e.preventDefault();
        hud.submitChat();
      } else if (e.code === "Escape") {
        e.preventDefault();
        hud.closeChat();
      }
      return;
    }
    const target = e.target;
    const typing = (target == null ? void 0 : target.tagName) === "INPUT" || (target == null ? void 0 : target.tagName) === "TEXTAREA";
    if (e.code === "Enter" && !typing && !(menu == null ? void 0 : menu.isOpen())) {
      e.preventDefault();
      e.stopImmediatePropagation();
      hud == null ? void 0 : hud.focusChat();
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      menu == null ? void 0 : menu.toggle();
      return;
    }
    if (typing || (menu == null ? void 0 : menu.isOpen())) return;
    const action = bindingFor(e.code);
    if (action) {
      e.preventDefault();
      e.stopImmediatePropagation();
      doAction(action);
      return;
    }
    if (e.code === "KeyL" || e.code === "KeyC") {
      e.stopImmediatePropagation();
      if (e.code === "KeyL") {
        debugOpen = !debugOpen;
        hud == null ? void 0 : hud.setDebug(debugOpen);
      } else if (e.code === "KeyC") {
        toggleCamera();
      }
    }
  }
  function onKeyUp(e) {
    if (settings.bindings.macroFeed === e.code) mb.setMacroFeed(false);
  }
  function onMouseDown(e) {
    if ((menu == null ? void 0 : menu.capturing()) || (menu == null ? void 0 : menu.isOpen()) || (hud == null ? void 0 : hud.chatFocused())) return;
    const action = bindingFor("Mouse" + e.button);
    if (action) {
      e.preventDefault();
      e.stopImmediatePropagation();
      doAction(action);
    }
  }
  function onMouseUp(e) {
    if (settings.bindings.macroFeed === "Mouse" + e.button) mb.setMacroFeed(false);
  }
  function doAction(a) {
    switch (a) {
      case "switchBox":
        mb.switchActive();
        break;
      case "split":
        mb.split();
        break;
      case "eject":
        mb.eject();
        break;
      case "doubleSplit":
        mb.doubleSplit();
        break;
      case "split16":
        mb.split16();
        break;
      case "respawn":
        mb.respawn();
        break;
      case "pause":
        mb.togglePause();
        break;
      case "spectateToggle":
        mb.spectateOrRoam();
        break;
      case "macroFeed":
        mb.setMacroFeed(true);
        break;
      case "togglePellets":
        settings.theme.showPellets = !settings.theme.showPellets;
        save();
        log(`[agarv2mod] pellets ${settings.theme.showPellets ? "shown" : "hidden"}`);
        break;
    }
  }
  function toggleCamera() {
    settings.game.multiboxCamera = settings.game.multiboxCamera === "center" ? "single" : "center";
    save();
    if (settings.game.multiboxCamera === "single") overlay == null ? void 0 : overlay.snapCamera();
    log(`[agarv2mod] camera -> ${settings.game.multiboxCamera}`);
  }
})();
