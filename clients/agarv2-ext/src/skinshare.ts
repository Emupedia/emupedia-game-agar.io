const MARKER = "~hsk~";
const TTL_MS = 60_000;

export class SkinShare {
  private map = new Map<string, { url: string; t: number }>();
  private seq = 0;

  encode(nick: string, url: string): string {
    const nonce = (this.seq = (this.seq + 1) & 0xffff).toString(36);
    return `${MARKER}${nonce} ${url} ${nick}`;
  }

  isMarker(message: string): boolean {
    return message.startsWith(MARKER);
  }

  ingest(message: string): boolean {
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

  get(nick: string): string {
    const e = this.map.get(nick);
    if (!e) return "";
    if (Date.now() - e.t > TTL_MS) {
      this.map.delete(nick);
      return "";
    }
    return e.url;
  }

  get size(): number {
    return this.map.size;
  }
}
