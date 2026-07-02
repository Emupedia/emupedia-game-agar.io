# @hslo/agar-ext — Agar v2 (Emupedia Cigar2) multibox overlay

A browser **userscript** + **Chrome MV3 extension** that hooks the Cigar2
WebSocket, decodes agar.io **protocol 6**, and draws a **two-socket multibox**
overlay cloning `game/apps/web`'s menu + HUD. Design & protocol notes:
[`../../docs/agar-overlay-extension.md`](../../docs/agar-overlay-extension.md).

> **Model (full takeover, exactly 2 sockets):** socket #1 is the game's own
> (hooked) connection; socket #2 is ours. We capture socket #1's real handshake
> (`254` protocol / `255` key — the key is computed inside `main_out.js` so it
> can't be minted) and replay it on socket #2, then **we** drive spawn + movement
> on **both**. On launch both sockets connect; **Play** spawns box 1, the first
> **TAB** spawns + controls box 2, **Spectate** sends opcode 1 on socket #1 (no
> third socket). Extra sockets mint a fresh reCAPTCHA token via the page's
> `grecaptcha` when present, else reuse P1's URL, else connect bare.

## Build

```bash
cd game
pnpm install                      # once (installs esbuild)
pnpm --filter @hslo/agar-ext build        # -> dist/ and dist-ext/
pnpm --filter @hslo/agar-ext build:watch  # rebuild on save
pnpm --filter @hslo/agar-ext typecheck
```

Outputs:
- `dist/agar-overlay.user.js` — the userscript.
- `dist-ext/` — unpacked MV3 extension (`manifest.json` + `content.js`).

## Run it

### Option A — Userscript (quickest)
1. Install **Tampermonkey** (or Violentmonkey).
2. Open `dist/agar-overlay.user.js`, copy its contents into a new userscript, save
   (or drag the file onto the Tampermonkey dashboard).
3. Open https://emupedia.net/emupedia-game-agar.io/cigar2/ and start a game.

### Option B — Chrome extension
1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `game/apps/agar-ext/dist-ext/`.
3. Open the cigar2 URL and play. (Reload the extension after each rebuild.)

## What you should see

- The cloned **menu** (profiles with color dots, nickname, per-box skin URLs,
  Play / Spectate / Settings / Controls / Theme), over our overlay.
- In the console: socket #1 `hooked`, `capture op 254/255`, then socket #2
  `connecting → open` — **two** ws2 connections, neither spawned yet.
- After **Play**: a cell spawns, camera follows it, the mass/box HUD updates.
- After **TAB**: box 2 spawns, its HUD chip lights up, the cursor drives it.

Hotkeys (rebindable in **Settings → Controls**; defaults match `game/apps/web`):
- **TAB** — switch which box you drive (first TAB deploys box 2).
- **Space** — split · **W** — eject · **R** — double split · **T** — split 16 ·
  **~** — respawn · **P** — pause camera · **Q** — spectate · **E** — macro-feed (hold).
- **Esc** — menu.

Utility (fixed): **O** overlay · **G** game canvas · **L** debug log ·
**C** camera mode (single = active box / center = frame both) · **wheel** zoom.

The view + HUD are cloned from `game/apps/web`: dark grid background, animated
border, soft cell shadows, names + mass, custom skins on your own cells, spiked
viruses, a multibox box indicator, a mass/stats readout, a leaderboard, and a
minimap. Colors come straight from the game (per-cell RGB). The game's own canvas
is `display:none` and its uncapped render loop is killed in takeover (the WS1 socket
stays alive for chat/handshake) so only our overlay draws. Coordinates are scramble-normalised
(per-connection offset recovered from the border centre) so the **center** camera
frames both boxes correctly.

> If box 1 doesn't spawn from our built packet, Play auto-falls-back to driving
> the game's own `#play-btn` (a guaranteed-valid spawn we then capture and replay
> for box 2). Watch the `[agar-ext]` console / the **[L]** debug log to diagnose.

### How extra sockets authenticate (WS subprotocol token — fixed 2026-06-28)

Symptom history: the AUX/box sockets used to loop `AUX: closed code=1006` while WS1 (the
game's own socket) connected fine. Cause: **the server gates every `ws2` connection on a
token passed as the WebSocket _subprotocol_ (`Sec-WebSocket-Protocol`), not a URL param.**
The old code connected the extra sockets bare (`new WebSocket(url)`), so the server `403`'d
the upgrade (browser close `1006`); WS1 worked only because the game passed the subprotocol.

The token is `ts.uuid.sha256(ts.uuid.origin.secret)`, computed **client-side** with a secret
baked into the game's `main.min.js` — so we mint a **fresh** one per socket (see
`mintWsToken()` in `src/client.ts`) and pass it as `new WebSocket(url, token)`, exactly like
the game mints WS1's. No `grecaptcha` / `?token=` needed (that path was removed). The hook
also captures WS1's subprotocol into `stats.wsProtocol` for diagnostics.

If extra sockets still `1006` after this: confirm the `[L]` log shows `proto=…` on each
connect (token is being sent), and test with any VPN/proxy off — some proxies strip the
`Sec-WebSocket-Protocol` header. A persistent refusal would point to a per-IP/concurrent cap.
See [`../../docs/agar-overlay-extension.md`](../../docs/agar-overlay-extension.md)
("Server status") for the full diagnosis.

### If the overlay looks wrong (this is the de-risk step)
Open DevTools console and read the `[agar-ext]` logs:
- **Status stuck on `waiting…`** — the socket regex didn't match. Check the logged
  socket URL and widen `GAME_SOCKET` in `src/hook.ts`.
- **`unknown op …` / `decode error`** — the live server's layout differs from the
  repo's `server3`. Note the opcode + hex dump and we'll adjust `src/protocol.ts`.
- **Cells in the wrong place / off-screen** — coordinates are a different width.
  Flip `COORD` in `src/protocol.ts` (`"i16"` ↔ `"i32"`) and rebuild. The logged
  `border` and first few node coords tell you which is right.
- **Colors off** — confirm the RGB byte order in the node record vs the log.

## Layout

```
src/protocol.ts  protocol-6 decoder (Reader + decodeServer; keeps skin)
src/encode.ts    client→server packets (UTF-8 spawn, move/split/eject/spectate)
src/world.ts     per-socket node store, render smoothing, scramble offsets
src/hook.ts      window.WebSocket monkey-patch (MAIN world, document-start)
src/client.ts    socket #2: connect + replay handshake, decode its world
src/multibox.ts  full-takeover 2-socket manager (launch connect, play/spectate/TAB)
src/overlay.ts   overlay canvas renderer (reuses ../web/lib/game/Camera)
src/settings.ts  settings model ported from ../web/settings.ts (localStorage)
src/ui/styles.ts injected CSS + DOM helpers (web-app palette)
src/ui/menu.ts   landing menu clone (profiles / nickname / skins / Play / Spectate)
src/ui/settings.ts  Settings panel clone (game/controls/theme/hud/data tabs)
src/ui/hud.ts    in-game HUD clone (gear / stats / box indicator / leaderboard)
src/main.ts      entry: install hook, mount overlay + menu/settings/HUD, hotkeys
build.mjs        esbuild -> userscript + unpacked extension
ext/manifest.json  MV3 manifest (content script, world: MAIN, document_start)
```
