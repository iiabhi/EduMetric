import net from 'node:net';

export interface HostPort {
  host: string;
  port: number;
}

/** Host and port of a connection URL. Credentials and path are ignored. */
export const parseHostPort = (url: string, defaultPort: number): HostPort => {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  return { host, port: parsed.port === '' ? defaultPort : Number(parsed.port) };
};

/** True if a TCP connection to host:port opens within timeoutMs. Never throws; the socket is always closed. */
export const probeTcp = (host: string, port: number, timeoutMs: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      finish(true);
    });
    socket.once('timeout', () => {
      finish(false);
    });
    socket.once('error', () => {
      finish(false);
    });
  });
