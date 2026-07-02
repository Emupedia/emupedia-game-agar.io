const LEGACY_SETTINGS_KEY = "settings";
const FP2_KEY = "agarv2mod-fp2";

let cached: string | null = null;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateFp2(): Promise<string> {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    crypto.randomUUID(),
  ].join("|");
  return sha256Hex(data);
}

function readLegacyFp2(): string {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY) || "{}");
    if (typeof legacy.fp2 === "string" && legacy.fp2.length >= 64) return legacy.fp2;
  } catch {}
  return "";
}

export function getFp2Sync(): string {
  return cached ?? "";
}

export async function ensureFp2(): Promise<string> {
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
  } catch {}

  cached = await generateFp2();
  try {
    localStorage.setItem(FP2_KEY, cached);
  } catch {}
  return cached;
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = s / 100;
  const ll = l / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (ss === 0) {
    r = g = b = ll;
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  const toByte = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

export function profileColors(hue: number) {
  return {
    cellColor: hslToHex(hue, 70, 55),
    nameColor: hslToHex(hue, 60, 75),
    borderColor: hslToHex(hue, 80, 40),
  };
}
