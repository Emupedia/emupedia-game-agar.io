import type { ChatLog } from "../chat";
import type { Multibox } from "../multibox";
import type { PacketLog } from "../packetlog";
import { formatMass, keyLabel, settings } from "../settings";
import type { Overlay } from "../overlay";
import { el } from "./styles";

export interface Hud {
  setDebug: (v: boolean) => void;
  setVisible: (v: boolean) => void;
  focusChat: () => void;
  chatFocused: () => boolean;
  submitChat: () => void;
  closeChat: () => void;
}

export function mountHud(opts: {
  mb: Multibox;
  overlay: Overlay;
  logLines: string[];
  packets: PacketLog;
  chat: ChatLog;
  copyText: () => string;
}): Hud {
  const { mb, overlay, logLines, packets, chat, copyText } = opts;
  let debug = false;
  let hudVisible = true;

  const stat = el("div", "agx-hud agx-stats");
  const boxbar = el("div", "agx-hud agx-boxbar");
  const lb = el("div", "agx-hud agx-lb");
  const log = el("div", "agx-hud agx-log");
  const copyBtn = el("button", "agx-hud agx-copybtn", { textContent: "Copy logs", title: "Copy packet transcript + log to clipboard" });
  copyBtn.addEventListener("click", () => {
    const text = copyText();
    const done = () => { copyBtn.textContent = "Copied"; setTimeout(() => (copyBtn.textContent = "Copy logs"), 1500); };
    navigator.clipboard?.writeText(text).then(done, () => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;left:-9999px";
      document.documentElement.append(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch { copyBtn.textContent = "copy failed - see console"; console.log(text); }
      ta.remove();
    });
  });
  const chatMsgs = el("div", "agx-chat-msgs");
  const chatInput = el("input", "agx-chat-input", { placeholder: "Press Enter to chat...", maxLength: 200 });
  const chatBox = el("div", "agx-hud agx-chat", {}, [chatMsgs, chatInput]);
  const submitChat = () => {
    const v = chatInput.value.trim().slice(0, 200);
    chatInput.value = "";
    if (v) mb.sendChat(v);
    chatInput.blur();
  };
  const closeChat = () => { chatInput.value = ""; chatInput.blur(); };

  document.documentElement.append(stat, boxbar, lb, chatBox, log, copyBtn);
  let chatRev = -1;

  const hint = () => {
    const b = settings.bindings;
    return `TAB box 2 - ${keyLabel(b.split)} split - ${keyLabel(b.eject)} eject - ${keyLabel(b.respawn)} respawn - Esc menu`;
  };

  setInterval(() => {
    const t = settings.theme;
    const hud = mb.hud();

    if (!hudVisible) {
      stat.style.display = boxbar.style.display = lb.style.display = chatBox.style.display = "none";
    } else {

    stat.style.display = t.showMass ? "block" : "none";
    if (t.showMass) {
      const fpsText = `${Math.round(overlay.fps)}${overlay.detectedFps ? ` / ${overlay.detectedFps}Hz` : ""}`;
      const pingText = hud.ping ? ` - ping: ${hud.ping}ms` : "";
      stat.replaceChildren(
        el("div", "", {}, [el("b", "", { textContent: `Mass ${formatMass(hud.mass, t.massFormat)}` })]),
        el("div", "", { textContent: `cells: ${hud.cellCount} - fps: ${fpsText}${pingText}` }),
      );
    }

    boxbar.replaceChildren();
    hud.players.forEach((p) => {
      const chip = el("div", "agx-chip", { textContent: p.label });
      const color = p.active ? t.activeOutline : "rgba(255,255,255,0.15)";
      Object.assign(chip.style, {
        borderColor: color,
        background: p.active ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.4)",
        color: p.alive ? (p.active ? "#fff" : "rgba(255,255,255,0.7)") : "#ef4444",
        opacity: p.connected ? "1" : "0.4",
        textDecoration: p.alive ? "none" : "line-through",
      } as Partial<CSSStyleDeclaration>);
      boxbar.append(chip);
    });
    boxbar.append(el("span", "agx-hint", { textContent: hint() }));

    const rows = t.showLeaderboard ? mb.leaderboard() : [];
    lb.style.display = rows.length ? "block" : "none";
    if (rows.length) {
      lb.replaceChildren(el("div", "agx-lb-h", { textContent: "Leaderboard" }));
      rows.slice(0, 10).forEach((e, i) => {
        lb.append(el("div", `agx-lb-row${e.id ? " agx-me" : ""}`, { textContent: `${i + 1}. ${e.name || "An unnamed cell"}` }));
      });
    }

    chatBox.style.display = t.showChat ? "flex" : "none";
    if (t.showChat && chat.rev !== chatRev) {
      chatRev = chat.rev;
      const atBottom = chatMsgs.scrollTop + chatMsgs.clientHeight >= chatMsgs.scrollHeight - 4;
      chatMsgs.replaceChildren(
        ...chat.msgs.map((m) =>
          el("div", "agx-chat-line", {}, [
            el("span", "agx-chat-name", { textContent: `${m.name || "-"}: `, style: `color:${m.color}` }),
            el("span", "", { textContent: m.message }),
          ]),
        ),
      );
      if (atBottom) chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }
    }

    log.style.display = debug ? "block" : "none";
    copyBtn.style.display = debug ? "block" : "none";
    if (debug) {
      log.textContent = [
        `${mb.status}`,
        `packets: ${packets.summary() || "(none yet)"}`,
        "-- recent (decoded) --",
        ...packets.tail(8),
        ...logLines.slice(-3),
      ].filter(Boolean).join("\n");
    }
  }, 200);

  return {
    setDebug: (v) => { debug = v; packets.setEnabled(v); },
    setVisible: (v) => {
      hudVisible = v;
      if (!v) { closeChat(); chatBox.style.display = "none"; }
    },
    focusChat: () => { if (settings.theme.showChat) chatInput.focus(); },
    chatFocused: () => document.activeElement === chatInput,
    submitChat,
    closeChat,
  };
}
