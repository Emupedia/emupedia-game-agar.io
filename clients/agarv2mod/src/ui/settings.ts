import {
  ACTION_LABELS,
  DEFAULT_BINDINGS,
  exportJson,
  importJson,
  keyLabel,
  save,
  settings,
  type ActionKey,
} from "../settings";
import { el } from "./styles";

export type SettingsTab = "game" | "controls" | "theme" | "data";
const ACTIONS = Object.keys(ACTION_LABELS) as ActionKey[];

export interface SettingsTabs {
  render: (tab: SettingsTab, body: HTMLElement) => void;
  capturing: () => boolean;
}

export function createSettingsTabs(rerender: () => void): SettingsTabs {
  let capturingAction: ActionKey | null = null;

  window.addEventListener("keydown", (e) => {
    if (!capturingAction) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code === "Backspace" || e.code === "Delete") { settings.bindings[capturingAction] = ""; save(); }
    else if (e.code !== "Escape") { settings.bindings[capturingAction] = e.code; save(); }
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

  function toggleRow(label: string, get: () => boolean, set: (v: boolean) => void) {
    const sw = el("div", `agx-switch${get() ? " agx-on" : ""}`);
    const row = el("div", "agx-row", {}, [el("span", "", { textContent: label }), sw]);
    row.style.cursor = "pointer";
    row.addEventListener("click", () => { set(!get()); save(); sw.classList.toggle("agx-on", get()); });
    return row;
  }
  function segRow<T extends string>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void) {
    const seg = el("div", "agx-seg");
    const paint = () => Array.from(seg.children).forEach((b, i) => b.classList.toggle("agx-on", opts[i][0] === get()));
    opts.forEach(([val, text]) => {
      const b = el("button", "", { textContent: text });
      b.addEventListener("click", () => { set(val); save(); paint(); });
      seg.append(b);
    });
    paint();
    const row = el("div", "agx-row", {}, [el("span", "", { textContent: label })]);
    row.append(seg);
    return row;
  }
  function colorRow(label: string, get: () => string, set: (v: string) => void, def: string) {
    const input = el("input", "agx-color", { type: "color", value: get() });
    input.addEventListener("input", () => { set(input.value); save(); });
    const reset = el("button", "agx-keybtn", { textContent: "reset" });
    reset.addEventListener("click", () => { set(def); input.value = def; save(); });
    const wrap = el("div", "", { style: "display:flex;gap:6px;align-items:center" }, [input, reset]);
    return el("div", "agx-row", {}, [el("span", "", { textContent: label }), wrap]);
  }

  function render(tab: SettingsTab, body: HTMLElement) {
    if (tab === "game") {
      body.append(segRow("Multibox camera mode", [["single", "Single"], ["center", "Center"]],
        () => settings.game.multiboxCamera, (v) => (settings.game.multiboxCamera = v)));
      body.append(segRow("Zoom", [["auto", "Auto-fit"], ["manual", "Manual"]],
        () => settings.game.zoomMode, (v) => (settings.game.zoomMode = v)));
      body.append(el("div", "agx-note", { textContent: "Manual: scroll the mouse wheel to zoom; the camera still follows your box." }));
      body.append(toggleRow("Inactive box stops at last cursor",
        () => settings.game.inactiveBoxStops, (v) => (settings.game.inactiveBoxStops = v)));
      const dd = el("input", "agx-slider", { type: "range", min: "20", max: "300", value: String(settings.game.drawDelay) });
      const ddLbl = el("span", "", { textContent: `Animation delay ${settings.game.drawDelay}ms` });
      dd.addEventListener("input", () => { settings.game.drawDelay = Number(dd.value); ddLbl.textContent = `Animation delay ${dd.value}ms`; save(); });
      body.append(el("div", "agx-row", {}, [ddLbl, dd]));
      body.append(el("div", "agx-note", { textContent: "How long cells take to glide to their server position. Lower = snappier, higher = smoother." }));
      body.append(toggleRow("Auto FPS - match display refresh",
        () => settings.game.autoFps, (v) => (settings.game.autoFps = v)));
      body.append(el("div", "agx-note", { textContent: "Measures your monitor's refresh rate and caps the overlay to it. Max FPS below still applies on top (0 = off)." }));
      const fps = el("input", "agx-keybtn", { type: "number", min: "30", max: "360", value: String(settings.game.maxFps), style: "width:70px" });
      fps.addEventListener("change", () => { settings.game.maxFps = Math.max(0, Math.min(360, Number(fps.value) | 0)); save(); });
      body.append(el("div", "agx-row", {}, [el("span", "", { textContent: "Max FPS - manual (0 = uncapped)" }), fps]));
      body.append(segRow("Resolution", [["1", "100%"], ["0.75", "75%"], ["0.5", "50%"]],
        () => String(settings.game.renderScale === 0.5 ? 0.5 : settings.game.renderScale === 0.75 ? 0.75 : 1) as "1" | "0.75" | "0.5",
        (v) => (settings.game.renderScale = Number(v))));
      body.append(el("div", "agx-note", { textContent: "Lower = sharper-but-slower -> softer-but-faster. Big FPS win on high-DPI screens." }));
    } else if (tab === "controls") {
      body.append(el("div", "agx-note", { textContent: "Click a binding, then press a key or click a mouse button to set it. Backspace clears, Esc cancels." }));
      for (const a of ACTIONS) {
        const btn = el("button", `agx-keybtn${capturingAction === a ? " agx-cap" : ""}`,
          { textContent: capturingAction === a ? "press a key / mouse..." : keyLabel(settings.bindings[a]) });
        btn.addEventListener("click", () => { capturingAction = a; rerender(); });
        body.append(el("div", "agx-row", {}, [el("span", "", { textContent: ACTION_LABELS[a] }), btn]));
      }
      const reset = el("button", "agx-btn", { textContent: "Reset to defaults" });
      reset.addEventListener("click", () => { settings.bindings = { ...DEFAULT_BINDINGS }; save(); rerender(); });
      body.append(reset);
      body.append(el("div", "agx-note", { textContent: "Advanced - split/eject WIRE opcodes (read from the [L] packet log: -> op=N when the game splits/ejects):" }));
      const numRow = (label: string, get: () => number, set: (v: number) => void) => {
        const inp = el("input", "agx-keybtn", { type: "number", value: String(get()), style: "width:70px" });
        inp.addEventListener("change", () => { set(Math.max(0, Math.min(255, Number(inp.value) | 0))); save(); });
        body.append(el("div", "agx-row", {}, [el("span", "", { textContent: label }), inp]));
      };
      numRow("Split opcode", () => settings.game.splitOp, (v) => (settings.game.splitOp = v));
      numRow("Eject opcode", () => settings.game.ejectOp, (v) => (settings.game.ejectOp = v));
      numRow("Chat opcode", () => settings.game.chatOp, (v) => (settings.game.chatOp = v));
    } else if (tab === "theme") {
      const t = settings.theme;
      body.append(toggleRow("Animated border", () => t.animatedBorder, (v) => (t.animatedBorder = v)));
      body.append(toggleRow("Cell shadows", () => t.cellShadow, (v) => (t.cellShadow = v)));
      body.append(toggleRow("Spawn effects", () => t.spawnEffects, (v) => (t.spawnEffects = v)));
      body.append(toggleRow("Background grid", () => t.showGrid, (v) => (t.showGrid = v)));
      body.append(toggleRow("Cell names", () => t.showNames, (v) => (t.showNames = v)));
      body.append(toggleRow("Custom skins (your skin URL on all your cells)", () => t.customSkins, (v) => (t.customSkins = v)));
      body.append(toggleRow("Game skins (server-provided)", () => t.gameSkins, (v) => (t.gameSkins = v)));
      body.append(colorRow("Active box outline", () => t.activeOutline, (v) => (t.activeOutline = v), "#ff3b30"));
      body.append(colorRow("Inactive box outline", () => t.inactiveOutline, (v) => (t.inactiveOutline = v), "#ffffff"));
      body.append(segRow("Ring size", [["thin", "Thin"], ["normal", "Normal"], ["thick", "Thick"]],
        () => (t.ringSize <= 0.6 ? "thin" : t.ringSize >= 1.6 ? "thick" : "normal"),
        (v) => (t.ringSize = v === "thin" ? 0.5 : v === "thick" ? 2 : 1)));
      body.append(toggleRow("Show pellets (X) - off for FPS", () => t.showPellets, (v) => (t.showPellets = v)));
      body.append(segRow("Pellets", [["game", "Game colors"], ["custom", "Custom"]],
        () => (t.pelletColor ? "custom" : "game"),
        (v) => (t.pelletColor = v === "custom" ? (t.pelletColor || "#88ccff") : "")));
      body.append(colorRow("Pellet color (when Custom)", () => t.pelletColor || "#88ccff", (v) => (t.pelletColor = v), "#88ccff"));
      body.append(el("div", "agx-label", { textContent: "BACKGROUND" }));
      body.append(colorRow("Background color", () => t.backgroundColor || "#0c0c16", (v) => (t.backgroundColor = v), "#0c0c16"));
      const bg = el("input", "agx-input agx-skin", { value: t.backgroundUrl, placeholder: "Background image URL (optional)" });
      bg.addEventListener("input", () => { t.backgroundUrl = bg.value.trim(); save(); });
      body.append(bg);
      body.append(el("div", "agx-label", { textContent: "HUD" }));
      body.append(toggleRow("Minimap", () => t.showMinimap, (v) => (t.showMinimap = v)));
      body.append(toggleRow("Leaderboard", () => t.showLeaderboard, (v) => (t.showLeaderboard = v)));
      body.append(toggleRow("Mass / stats", () => t.showMass, (v) => (t.showMass = v)));
      body.append(segRow("Mass format", [["auto", "Auto"], ["short", "Short"], ["full", "Full"]],
        () => t.massFormat, (v) => (t.massFormat = v)));
      body.append(toggleRow("Kill feed", () => t.showKillFeed, (v) => (t.showKillFeed = v)));
      body.append(toggleRow("Chat", () => t.showChat, (v) => (t.showChat = v)));
    } else {
      const exp = el("button", "agx-btn", { textContent: "Export settings (.hsf.json)" });
      exp.addEventListener("click", () => {
        const blob = new Blob([exportJson()], { type: "application/json" });
        const a = el("a", "", { href: URL.createObjectURL(blob), download: "hslo-agarv2mod.hsf.json" });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      const file = el("input", "", { type: "file", accept: ".json,.hsf,application/json", style: "display:none" });
      file.addEventListener("change", () => {
        const f = file.files?.[0];
        if (!f) return;
        f.text().then((txt) => { if (!importJson(txt)) alert("Import failed: invalid settings file"); else rerender(); });
      });
      const imp = el("button", "agx-btn", { textContent: "Import settings..." });
      imp.addEventListener("click", () => file.click());
      body.append(exp, imp, file);
    }
  }

  return { render, capturing: () => capturingAction !== null };
}
