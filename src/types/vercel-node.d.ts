declare module '@vercel/node' {
  import { IncomingMessage, ServerResponse } from 'http';
  export type VercelRequest = IncomingMessage & {
    body?: any;
    query?: Record<string, string | string[]>;
  };
  export type VercelResponse = ServerResponse & {
    status?: (code: number) => VercelResponse;
    json?: (body: any) => void;
    send?: (body: any) => void;
  };
  export {};
}