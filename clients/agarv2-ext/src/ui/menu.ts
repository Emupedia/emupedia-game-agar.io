import type { Multibox } from "../multibox";
import { DEFAULT_BOX_COUNT, save, settings, type Profile } from "../settings";
import { createSettingsTabs, type SettingsTab } from "./settings";
import { el } from "./styles";

type MenuTab = "play" | SettingsTab;

const PANEL_WIDTH = "min(960px, 94vw)";
const PANEL_HEIGHT = "min(640px, 65vh)";
const PANEL_RADIUS = "24px";

const TABS: [MenuTab, string][] = [
  ["play", "Game"],
  ["game", "Settings"],
  ["controls", "Controls"],
  ["theme", "Theme"],
  ["data", "Data"],
];

export interface Menu {
  open: (tab?: MenuTab) => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  capturing: () => boolean;
  dispose: () => void;
}

export function mountMenu(mb: Multibox): Menu {
  const card = el("div", "agx-card", { style: `width:${PANEL_WIDTH};height:${PANEL_HEIGHT};border-radius:${PANEL_RADIUS}` });
  const overlay = el("div", "agx-overlay", {}, [card]);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.documentElement.appendChild(overlay);

  const settingsTabs = createSettingsTabs(() => render());

  let tab: MenuTab = "play";
  let skinPopFor: number | null = null;

  const setOpen = (v: boolean) => overlay.classList.toggle("agx-open", v);
  const isOpen = () => overlay.classList.contains("agx-open");
  const open = (t?: MenuTab) => { if (t) tab = t; skinPopFor = null; render(); setOpen(true); };
  const close = () => setOpen(false);
  const toggle = () => (isOpen() ? close() : open());

  const prof = () => settings.profiles[settings.selected];

  function doPlay() {
    save();
    mb.play();
    close();
  }
  function doSpectate() {
    mb.spectate();
    close();
  }

  function applySkinBg(c: HTMLElement, p: Profile) {
    const skin = (p.skins.find((s) => !!s) || "").trim();
    if (skin) {
      c.classList.add("agx-has-skin");
      c.style.backgroundImage = `url("${skin.replace(/"/g, "%22")}")`;
    } else {
      c.classList.remove("agx-has-skin");
      c.style.backgroundImage = "";
    }
  }

  function renderSkinPop(i: number, circleEl: HTMLElement | undefined) {
    const p = settings.profiles[i];
    const pop = el("div", "agx-skinpop");
    const x = el("button", "agx-x", { textContent: "x" });
    x.addEventListener("click", () => { skinPopFor = null; render(); });
    pop.append(el("div", "agx-skinpop-h", {}, [el("span", "", { textContent: `${p.name || `Profile ${i + 1}`} skins` }), x]));
    for (let box = 0; box < DEFAULT_BOX_COUNT; box++) {
      const inp = el("input", "agx-input agx-skin", { value: p.skins[box] ?? "", placeholder: `Box ${box + 1} skin URL` });
      inp.addEventListener("input", () => {
        p.skins[box] = inp.value.trim();
        save();
        if (circleEl) applySkinBg(circleEl, p);
      });
      pop.append(inp);
    }
    return pop;
  }

  function renderPlay(body: HTMLElement) {
    const game = el("div", "agx-game");
    const circleEls: HTMLElement[] = [];

    const left = el("div", "agx-game-left");
    left.append(el("h1", "agx-title", { textContent: "Agar.io" }));
    left.append(el("p", "agx-sub", { textContent: "Custom overlay - Play & Spectate" }));
    left.append(el("div", "agx-label", { textContent: "NICKNAME", style: "text-align:center" }));
    const nick = el("input", "agx-input agx-nick", { value: prof().name, placeholder: "An unnamed cell", maxLength: 15 });
    nick.addEventListener("input", () => { prof().name = nick.value.slice(0, 15); save(); });
    nick.addEventListener("change", () => { prof().name = nick.value.slice(0, 15); save(); mb.refreshChatNick(); });
    nick.addEventListener("keydown", (e) => { if (e.key === "Enter") doPlay(); });
    left.append(nick);
    left.append(el("div", "agx-label", { textContent: "SKINS - image URL per box", style: "text-align:center" }));
    for (let box = 0; box < DEFAULT_BOX_COUNT; box++) {
      const skin = el("input", "agx-input agx-skin", { value: prof().skins[box] ?? "", placeholder: `Box ${box + 1} skin URL` });
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
      const c = el("button", `agx-pcircle${i === settings.selected ? " agx-sel" : ""}`,
        { textContent: p.name ? p.name[0].toUpperCase() : String(i + 1) });
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
      b.addEventListener("click", () => { tab = t; skinPopFor = null; render(); });
      tabBar.append(b);
    }
    card.append(tabBar);

    const body = el("div", "agx-body");
    card.append(body);
    if (tab === "play") renderPlay(body);
    else settingsTabs.render(tab, body);
  }

  return { open, close, toggle, isOpen, capturing: () => settingsTabs.capturing(), dispose: () => overlay.remove() };
}
