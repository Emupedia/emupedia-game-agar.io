export interface ChatMsg {
  name: string;
  message: string;
  color: string;
  t: number;
}

export class ChatLog {
  msgs: ChatMsg[] = [];
  rev = 0;

  add(name: string, message: string, color: string) {
    this.msgs.push({ name, message, color, t: Date.now() });
    if (this.msgs.length > 100) this.msgs.shift();
    this.rev++;
  }
}
