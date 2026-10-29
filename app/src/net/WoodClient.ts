// Tiny WebSocket client that keeps a phone connected to its wood (room),
// reconnecting with backoff when the network drops or the phone sleeps.

export type NetStatus = 'offline' | 'connecting' | 'online';

export class WoodClient {
  private ws: WebSocket | null = null;
  private url = '';
  private hello: () => object = () => ({});
  private want = false;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  status: NetStatus = 'offline';
  onMessage: (msg: any) => void = () => {};
  onStatus: (status: NetStatus) => void = () => {};

  connect(url: string, hello: () => object) {
    this.close();
    this.url = url;
    this.hello = hello;
    this.want = true;
    this.retry = 0;
    this.open();
  }

  send(msg: object) {
    if (this.ws && this.ws.readyState === 1 && this.status === 'online') {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  close() {
    this.want = false;
    if (this.timer) clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.setStatus('offline');
  }

  private setStatus(status: NetStatus) {
    if (status === this.status) return;
    this.status = status;
    this.onStatus(status);
  }

  private open() {
    if (!this.want) return;
    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(this.hello()));
    ws.onmessage = (e) => {
      let msg: any;
      try { msg = JSON.parse(String(e.data)); } catch { return; }
      if (msg.t === 'welcome') { this.retry = 0; this.setStatus('online'); }
      this.onMessage(msg);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.want) { this.setStatus('connecting'); this.scheduleRetry(); } else this.setStatus('offline');
    };
  }

  private scheduleRetry() {
    if (!this.want) return;
    if (this.timer) clearTimeout(this.timer);
    const delay = Math.min(15_000, 1000 * 2 ** this.retry++);
    this.timer = setTimeout(() => this.open(), delay);
  }
}
