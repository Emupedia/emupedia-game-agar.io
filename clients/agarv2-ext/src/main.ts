import { ChatLog } from "./chat";
import { installWsHook, type GameLink, type HookStats } from "./hook";
import { Multibox } from "./multibox";
import { Overlay } from "./overlay";
import { PacketLog } from "./packetlog";
import { save, settings, type ActionKey } from "./settings";
import { SkinShare } from "./skinshare";
import { mountHud } from "./ui/hud";
import { mountMenu } from "./ui/menu";
import { injectStyles } from "./ui/styles";
import { World } from "./world";

const world = new World();
const stats: HookStats = {
  attached: false,
  url: "",
  frames: 0,
  unknownOps: new Set(),
  sends: [],
};
const link: GameLink = {
  ws: null,
  suppressMove: false,
  suppressAction: false,
  suppressSpawn: false,
  sendRaw: null,
  blocked: false,
};

const logLines: string[] = [];
function log(...args: unknown[]) {
  logLines.push(
    args.map((a) => (typeof a === "string" ? a : safeJson(a))).join(" "),
  );
  if (logLines.length > 30) logLines.shift();
  console.log(...args);
}
function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const packets = new PacketLog();
const chat = new ChatLog();
const skinShare = new SkinShare();

installWsHook(world, stats, link, log, packets, chat, skinShare);
const mb = new Multibox(world, link, stats, log, skinShare, chat);

const gameSockets = new Set<WebSocket>();
let killWs1 = false;
function closeGameSocket(ws: WebSocket) {
  try { ws.onclose = null; ws.onerror = null; ws.onmessage = null; } catch {}
  try { ws.close(); } catch {}
}
function grabGameSocket(ws: WebSocket) {
  gameSockets.add(ws);
  if (killWs1) setTimeout(() => closeGameSocket(ws), 0);
}
function hookIframeSocket() {
  try {
    const iframe = document.getElementById("multicheck") as HTMLIFrameElement | null;
    const cw = iframe?.contentWindow as (Window & { WebSocket?: typeof WebSocket }) | null | undefined;
    const WS = cw?.WebSocket;
    const proto = WS?.prototype as (WebSocket & { __agxHooked?: boolean }) | undefined;
    if (!proto || proto.__agxHooked) return;
    proto.__agxHooked = true;
    const origSend = proto.send;
    proto.send = function (this: WebSocket, data: Parameters<WebSocket["send"]>[0]) {
      grabGameSocket(this);
      if (killWs1) return;
      return origSend.call(this, data);
    } as WebSocket["send"];
    const bt = Object.getOwnPropertyDescriptor(proto, "binaryType");
    if (bt?.get && bt?.set) {
      const getter = bt.get, setter = bt.set;
      Object.defineProperty(proto, "binaryType", {
        configurable: true,
        enumerable: bt.enumerable,
        get() { return getter.call(this); },
        set(v) { grabGameSocket(this); setter.call(this, v); },
      });
    }
    log("[agar-ext] iframe game-socket hooked");
  } catch {}
}
setInterval(hookIframeSocket, 100);
hookIframeSocket();

let longTasks = 0;
let worstTaskMs = 0;
try {
  if ("PerformanceObserver" in window) {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.duration < 80) continue;
        longTasks++;
        worstTaskMs = Math.max(worstTaskMs, Math.round(e.duration));
        const ws1 = link.ws?.readyState === WebSocket.OPEN ? "open" : "down";
        log(`[freeze] main thread blocked ${Math.round(e.duration)}ms | nodes=${overlay?.dbgNodes ?? 0} cells=${overlay?.dbgCells ?? 0} ws1=${ws1} gameKilled=${killGameRAF}`);
      }
    });
    po.observe({ entryTypes: ["longtask"] });
  }
} catch {}

function copyText(): string {
  return `${packets.dump()}\n\n=== text log ===\n${logLines.join("\n")}`;
}

let overlay: Overlay | null = null;
let menu: ReturnType<typeof mountMenu> | null = null;
let hud: ReturnType<typeof mountHud> | null = null;
let takeover = true;
let gameCanvasHidden = true;
let debugOpen = false;
let bannerEl: HTMLElement | null = null;
let wired = false;

const realRAF = window.requestAnimationFrame.bind(window);
let throttleGameRAF = false;
let killGameRAF = false;
let fakeRafId = 0x70000000;
let lastGameRaf: FrameRequestCallback | null = null;
window.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
  if ((cb as { __hsloKeep?: boolean }).__hsloKeep) return realRAF(cb);
  if (takeover) {
    if (killGameRAF) { lastGameRaf = cb; return ++fakeRafId; }
    if (throttleGameRAF) return window.setTimeout(() => cb(performance.now()), 1000 / 15);
  }
  return realRAF(cb);
}) as typeof window.requestAnimationFrame;

for (const key of ["String", "requestAnimationFrame"] as const) {
  try {
    Object.defineProperty(window, key, { value: window[key], writable: false, configurable: false });
  } catch {}
}

(window as unknown as { __hslo?: unknown }).__hslo = {
  killGameRender(on = true) {
    killGameRAF = on;
    if (on) throttleGameRAF = false;
    log(`[agar-ext] game render ${on ? "KILLED (no draw)" : "revived"}`);
    if (!on && lastGameRaf) { const cb = lastGameRaf; lastGameRaf = null; realRAF(cb); }
  },
  freezeGame(on = true) {
    throttleGameRAF = on;
    if (on) killGameRAF = false;
    log(`[agar-ext] game render ${on ? "throttled -> 15fps" : "full"}`);
    if (lastGameRaf) { const cb = lastGameRaf; lastGameRaf = null; realRAF(cb); }
  },
  killWS1() {
    killWs1 = true;
    for (const ws of gameSockets) closeGameSocket(ws);
    log("[agar-ext] WS1 killed (iframe game socket closed, reconnect suppressed)");
  },
  reviveWS1() {
    killWs1 = false;
    log("[agar-ext] WS1 revive: kill disabled (game may reconnect)");
  },
  fps: () => Math.round(overlay?.fps ?? 0),
  perf() {
    const deltas: number[] = [];
    let prev = performance.now();
    let n = 0;
    const tick = () => {
      const now = performance.now();
      deltas.push(now - prev);
      prev = now;
      if (++n < 60) realRAF(tick);
      else {
        deltas.sort((a, b) => a - b);
        const med = deltas[deltas.length >> 1];
        const fast = deltas[2];
        log(
          `[perf] RAF median ${med.toFixed(1)}ms (~${Math.round(1000 / med)}fps ceiling), fastest ${fast.toFixed(1)}ms (~${Math.round(1000 / fast)}fps) | overlay ${Math.round(overlay?.fps ?? 0)}fps, draw ${(overlay?.drawMs ?? 0).toFixed(2)}ms | cells ${overlay?.dbgCells ?? 0}, food ${overlay?.dbgFood ?? 0}, nodes ${overlay?.dbgNodes ?? 0} | gameKilled=${killGameRAF} gameThrottled=${throttleGameRAF} takeover=${takeover} autoFps=${settings.game.autoFps} detectedHz=${overlay?.detectedFps ?? 0} maxFps=${settings.game.maxFps} | stalls=${overlay?.stalls ?? 0} lastStall=${overlay?.lastStallMs ?? 0}ms longTasks=${longTasks} worstTask=${worstTaskMs}ms`,
        );
      }
    };
    realRAF(tick);
    return "sampling 60 frames... result prints to the console (and the [L] log) shortly";
  },
};

const throttleStart = setInterval(() => {
  if (!overlay) return;
  clearInterval(throttleStart);
  setTimeout(() => {
    killGameRAF = true;
    killWs1 = true;
    for (const ws of gameSockets) closeGameSocket(ws);
    log("[agar-ext] game render killed + WS1 cut (overlay owns the screen)");
  }, 2000);
}, 250);

function start() {
  if (overlay) return;
  injectStyles();
  overlay = new Overlay(mb);
  mb.attachOverlay(overlay);
  applyGameCanvasVisibility();
  menu = mountMenu(mb);
  hud = mountHud({
    mb,
    overlay,
    logLines,
    stats,
    packets,
    chat,
    copyText,
  });
  debugOpen = false;
  hud.setDebug(false);
  menu.open();
  let muPass = 0;
  const reapply = () => {
    if (muPass) return;
    muPass = window.setTimeout(() => { muPass = 0; applyGameCanvasVisibility(); }, 400);
  };
  if (document.body) new MutationObserver(reapply).observe(document.body, { childList: true, subtree: true });
  if (!wired) {
    wired = true;
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("contextmenu", (e) => {
      if (takeover && !menu?.isOpen() && bindingFor("Mouse2")) e.preventDefault();
    }, true);
  }
}

function setTakeover(v: boolean) {
  takeover = v;
  gameCanvasHidden = v;
  link.suppressMove = v;
  link.suppressSpawn = v;
  overlay?.setVisible(v);
  hud?.setVisible(v);
  applyGameCanvasVisibility();
  if (v) {
    hideBanner();
    menu?.open();
  } else {
    if (lastGameRaf) { const cb = lastGameRaf; lastGameRaf = null; realRAF(cb); }
    menu?.close();
    showHint(
      "OBSERVE MODE - use the game's own menu. Press O for the extension overlay - Esc for its menu.",
    );
  }
}

function showHint(msg: string) {
  if (!bannerEl) {
    bannerEl = document.createElement("div");
    bannerEl.className = "agx-hud agx-banner";
    document.documentElement.appendChild(bannerEl);
  }
  bannerEl.textContent = msg;
  bannerEl.style.display = "block";
}
function hideBanner() {
  if (bannerEl) bannerEl.style.display = "none";
}

function boot() {
  if (overlay && document.documentElement.contains(overlay.canvas)) return;
  if (!document.body) return;
  if (overlay) {
    overlay = null;
    menu = null;
    hud = null;
    log("[agar-ext] UI detached - remounting into live document");
  }
  try {
    start();
  } catch (e) {
    overlay = null;
    console.error("[agar-ext] start() failed:", e);
  }
}
window.addEventListener("load", boot);
document.addEventListener("readystatechange", boot);
setInterval(boot, 500);
boot();

function applyGameCanvasVisibility() {
  for (const c of Array.from(document.querySelectorAll("canvas"))) {
    if (overlay && c === overlay.canvas) continue;
    const cs = (c as HTMLCanvasElement).style;
    cs.opacity = "";
    cs.display = gameCanvasHidden ? "none" : "";
  }
  if (document.body) document.body.style.pointerEvents = takeover ? "none" : "";
  hideGameUi(takeover);
}

function hideGameUi(hide: boolean) {
  if (!document.body) return;
  for (const el of Array.from(document.body.children) as HTMLElement[]) {
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "NOSCRIPT") continue;
    if (/recaptcha|grecaptcha/i.test(`${el.id} ${el.className}`)) continue;
    if (tag === "CANVAS" || el.querySelector("canvas")) continue;
    el.style.display = hide ? "none" : "";
  }
}

function bindingFor(code: string): ActionKey | undefined {
  return (Object.keys(settings.bindings) as ActionKey[]).find(
    (k) => settings.bindings[k] === code,
  );
}

function onKeyDown(e: KeyboardEvent) {
  if (menu?.capturing()) return;
  if (hud?.chatFocused()) {
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
  const target = e.target as HTMLElement | null;
  const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

  if (
    takeover &&
    e.code === "Enter" &&
    !typing &&
    !menu?.isOpen()
  ) {
    e.preventDefault();
    e.stopImmediatePropagation();
    hud?.focusChat();
    return;
  }

  if (e.code === "Escape") {
    e.preventDefault();
    menu?.toggle();
    return;
  }
  if (typing || menu?.isOpen()) return;

  if (takeover) {
    const action = bindingFor(e.code);
    if (action) {
      e.preventDefault();
      e.stopImmediatePropagation();
      doAction(action);
      return;
    }
  }

  if (
    e.code === "KeyO" ||
    e.code === "KeyL" ||
    e.code === "KeyG" ||
    e.code === "KeyC"
  ) {
    if (takeover) e.stopImmediatePropagation();
    if (e.code === "KeyO") setTakeover(!takeover);
    else if (e.code === "KeyL") {
      debugOpen = !debugOpen;
      hud?.setDebug(debugOpen);
    } else if (e.code === "KeyG") {
      gameCanvasHidden = !gameCanvasHidden;
      applyGameCanvasVisibility();
    } else if (e.code === "KeyC") toggleCamera();
    return;
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (settings.bindings.macroFeed === e.code) mb.setMacroFeed(false);
}

function onMouseDown(e: MouseEvent) {
  if (menu?.capturing() || menu?.isOpen() || !takeover || hud?.chatFocused()) return;
  const action = bindingFor("Mouse" + e.button);
  if (action) {
    e.preventDefault();
    e.stopImmediatePropagation();
    doAction(action);
  }
}

function onMouseUp(e: MouseEvent) {
  if (settings.bindings.macroFeed === "Mouse" + e.button) mb.setMacroFeed(false);
}

function doAction(a: ActionKey) {
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
      mb.spectate();
      break;
    case "macroFeed":
      mb.setMacroFeed(true);
      break;
    case "togglePellets":
      settings.theme.showPellets = !settings.theme.showPellets;
      save();
      log(`[agar-ext] pellets ${settings.theme.showPellets ? "shown" : "hidden"}`);
      break;
  }
}

function toggleCamera() {
  settings.game.multiboxCamera =
    settings.game.multiboxCamera === "center" ? "single" : "center";
  save();
  if (settings.game.multiboxCamera === "single") overlay?.snapCamera();
  log(`[agar-ext] camera -> ${settings.game.multiboxCamera}`);
}
