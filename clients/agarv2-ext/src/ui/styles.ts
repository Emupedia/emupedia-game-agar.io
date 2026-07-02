const CSS = `
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
.agx-slider { width: 300px; max-width: 45%; }
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

let injected = false;
export function injectStyles() {
  if (injected) return;
  injected = true;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return;
  } catch {}
  const s = document.createElement("style");
  s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  props: Partial<Omit<HTMLElementTagNameMap[K], "style">> & { style?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  const { style, ...rest } = props as { style?: string } & Record<string, unknown>;
  Object.assign(e, rest);
  if (style) e.style.cssText = style;
  for (const c of children) e.append(c);
  return e;
}
