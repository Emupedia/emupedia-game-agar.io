import { ClientOp } from "./opcodes";

export const DEFAULT_BOX_COUNT = 2;

export interface Profile {
  name: string;
  hue: number;
  skins: string[];
}

export type ActionKey =
  | "split"
  | "eject"
  | "macroFeed"
  | "doubleSplit"
  | "split16"
  | "switchBox"
  | "respawn"
  | "pause"
  | "spectateToggle"
  | "togglePellets";

export type Bindings = Record<ActionKey, string>;

export interface ThemeSettings {
  showGrid: boolean;
  showMinimap: boolean;
  showLeaderboard: boolean;
  showMass: boolean;
  showKillFeed: boolean;
  showChat: boolean;
  showNames: boolean;
  customSkins: boolean;
  gameSkins: boolean;
  massFormat: "auto" | "short" | "full";
  ringSize: number;
  pelletColor: string;
  showPellets: boolean;
  animatedBorder: boolean;
  cellShadow: boolean;
  spawnEffects: boolean;
  backgroundColor: string;
  backgroundUrl: string;
  activeOutline: string;
  inactiveOutline: string;
}

export type MultiboxCamera = "single" | "center";
export type ZoomMode = "auto" | "manual";

export interface GameSettings {
  multiboxCamera: MultiboxCamera;
  zoomMode: ZoomMode;
  inactiveBoxStops: boolean;
  spectatorView: boolean;
  drawDelay: number;
  splitOp: number;
  ejectOp: number;
  chatOp: number;
  autoFps: boolean;
  maxFps: number;
  renderScale: number;
}

export const ACTION_LABELS: Record<ActionKey, string> = {
  split: "Split",
  eject: "Eject (single)",
  macroFeed: "Eject / feed (hold)",
  doubleSplit: "Double split (x2)",
  split16: "Multi split (x4)",
  switchBox: "Switch box",
  respawn: "Respawn",
  pause: "Pause camera",
  spectateToggle: "Spectate: follow #1 / free",
  togglePellets: "Hide / show pellets",
};

export const DEFAULT_BINDINGS: Bindings = {
  split: "Space",
  eject: "",
  macroFeed: "KeyE",
  doubleSplit: "KeyG",
  split16: "KeyT",
  switchBox: "Tab",
  respawn: "Backquote",
  pause: "KeyP",
  spectateToggle: "KeyQ",
  togglePellets: "KeyX",
};

export const DEFAULT_THEME: ThemeSettings = {
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
  inactiveOutline: "#ffffff",
};

export const DEFAULT_GAME: GameSettings = {
  multiboxCamera: "single",
  zoomMode: "auto",
  inactiveBoxStops: false,
  spectatorView: false,
  drawDelay: 70,
  splitOp: ClientOp.SPLIT,
  ejectOp: ClientOp.EJECT,
  chatOp: ClientOp.CHAT,
  autoFps: true,
  maxFps: 144,
  renderScale: 1,
};

export interface Settings {
  profiles: Profile[];
  selected: number;
  bindings: Bindings;
  theme: ThemeSettings;
  game: GameSettings;
}

const emptyProfile = (): Profile => ({
  name: "",
  hue: 200,
  skins: Array.from({ length: DEFAULT_BOX_COUNT }, () => ""),
});
const defaultProfiles = (): Profile[] => Array.from({ length: 9 }, emptyProfile);

const STORAGE_KEY = "agarv2mod-settings";
const BINDINGS_VERSION_KEY = "agarv2mod-bindv";
const BINDINGS_VERSION = "4";
const CHAT_OP_FIX_KEY = "agarv2mod-chatopfix";
const SPECTATOR_OFF_KEY = "agarv2mod-specoff";

function normalizeProfile(p: Partial<Profile> | undefined): Profile {
  const skins = Array.isArray(p?.skins) ? p!.skins.slice(0, DEFAULT_BOX_COUNT) : [];
  while (skins.length < DEFAULT_BOX_COUNT) skins.push("");
  return { name: typeof p?.name === "string" ? p.name : "", hue: typeof p?.hue === "number" ? p.hue : 200, skins };
}

function load(): Settings {
  const base: Settings = {
    profiles: defaultProfiles(),
    selected: 0,
    bindings: { ...DEFAULT_BINDINGS },
    theme: { ...DEFAULT_THEME },
    game: { ...DEFAULT_GAME },
  };
  try {
    const o = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(o.profiles) && o.profiles.length) base.profiles = o.profiles.map(normalizeProfile);
    if (typeof o.selected === "number") base.selected = Math.max(0, Math.min(8, o.selected));
    base.bindings = { ...DEFAULT_BINDINGS, ...(o.bindings ?? {}) };
    base.theme = { ...DEFAULT_THEME, ...(o.theme ?? {}) };
    base.game = { ...DEFAULT_GAME, ...(o.game ?? {}) };
    const legacyDelay = (o.game as { animationDelay?: number } | undefined)?.animationDelay;
    if (typeof legacyDelay === "number" && typeof o.game?.drawDelay !== "number") {
      base.game.drawDelay = Math.max(20, Math.min(400, 70));
    }
    if (!base.theme.backgroundColor) base.theme.backgroundColor = DEFAULT_THEME.backgroundColor;
    if (localStorage.getItem(BINDINGS_VERSION_KEY) !== BINDINGS_VERSION) {
      base.bindings = { ...DEFAULT_BINDINGS };
      try { localStorage.setItem(BINDINGS_VERSION_KEY, BINDINGS_VERSION); } catch {}
    }
    if (localStorage.getItem(CHAT_OP_FIX_KEY) !== "1") {
      base.game.chatOp = ClientOp.CHAT;
      try { localStorage.setItem(CHAT_OP_FIX_KEY, "1"); } catch {}
    }
    if (localStorage.getItem(SPECTATOR_OFF_KEY) !== "1") {
      base.game.spectatorView = false;
      try { localStorage.setItem(SPECTATOR_OFF_KEY, "1"); } catch {}
    }
  } catch {}
  return base;
}

export const settings: Settings = load();
save();

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function currentProfile(): Profile {
  return settings.profiles[settings.selected] ?? emptyProfile();
}

export function exportJson(): string {
  return JSON.stringify(settings, null, 2);
}

export function importJson(json: string): boolean {
  try {
    const o = JSON.parse(json);
    settings.profiles = Array.isArray(o.profiles) && o.profiles.length ? o.profiles.map(normalizeProfile) : defaultProfiles();
    settings.selected = typeof o.selected === "number" ? Math.max(0, Math.min(8, o.selected)) : 0;
    settings.bindings = { ...DEFAULT_BINDINGS, ...(o.bindings ?? {}) };
    settings.theme = { ...DEFAULT_THEME, ...(o.theme ?? {}) };
    settings.game = { ...DEFAULT_GAME, ...(o.game ?? {}) };
    save();
    return true;
  } catch {
    return false;
  }
}

export function formatMass(m: number, fmt: "auto" | "short" | "full"): string {
  const r = Math.round(m);
  const k = (x: number) => `${(x / 1000).toFixed(1)}k`;
  if (fmt === "full") return r.toLocaleString();
  if (fmt === "short") return r >= 1000 ? k(r) : String(r);
  return r >= 10000 ? k(r) : r.toLocaleString();
}

export function keyLabel(code: string): string {
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
