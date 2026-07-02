import { ChatLog } from "./chat";
import { ensureFp2 } from "./fp2";
import { Multibox } from "./multibox";
import { Overlay } from "./overlay";
import { PacketLog } from "./packetlog";
import { save, settings, type ActionKey } from "./settings";
import { SkinShare } from "./skinshare";
import { mountHud } from "./ui/hud";
import { mountMenu } from "./ui/menu";
import { injectStyles } from "./ui/styles";

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
const mb = new Multibox(log, skinShare, chat);

let overlay: Overlay | null = null;
let menu: ReturnType<typeof mountMenu> | null = null;
let hud: ReturnType<typeof mountHud> | null = null;
let debugOpen = false;
let wired = false;

function copyText(): string {
  return `${packets.dump()}\n\n=== text log ===\n${logLines.join("\n")}`;
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
    copyText,
  });
  debugOpen = false;
  hud.setDebug(false);
  menu.open();
  if (!wired) {
    wired = true;
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("contextmenu", (e) => {
      if (!menu?.isOpen() && bindingFor("Mouse2")) e.preventDefault();
    }, true);
  }
}

async function boot() {
  if (overlay && document.documentElement.contains(overlay.canvas)) return;
  if (!document.body) return;
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
void boot();

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

  if (e.code === "Enter" && !typing && !menu?.isOpen()) {
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
      hud?.setDebug(debugOpen);
    } else if (e.code === "KeyC") {
      toggleCamera();
    }
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (settings.bindings.macroFeed === e.code) mb.setMacroFeed(false);
}

function onMouseDown(e: MouseEvent) {
  if (menu?.capturing() || menu?.isOpen() || hud?.chatFocused()) return;
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
      log(`[agarv2mod] pellets ${settings.theme.showPellets ? "shown" : "hidden"}`);
      break;
  }
}

function toggleCamera() {
  settings.game.multiboxCamera =
    settings.game.multiboxCamera === "center" ? "single" : "center";
  save();
  if (settings.game.multiboxCamera === "single") overlay?.snapCamera();
  log(`[agarv2mod] camera -> ${settings.game.multiboxCamera}`);
}
