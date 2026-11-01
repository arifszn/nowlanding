// Telegram Bot API client (ky) and the delivery channel interface.
import ky, { HTTPError, type KyInstance } from "npm:ky@2.2.0";
export { escapeHtml } from "./message.ts";

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

export type SendResult =
  | { ok: true }
  | { ok: false; kind: "blocked" | "rate_limited" | "error"; retryAfter?: number; error: string };

/** Delivery channel. Only Telegram exists in v1. */
export interface Channel {
  send(chatId: number, html: string, photos?: string[]): Promise<SendResult>;
}

/** Telegram caps photo captions at 1024 characters (after entity parsing; we count raw HTML to stay safe). */
export const CAPTION_LIMIT = 1024;
export const ALBUM_LIMIT = 10;

export class TelegramClient implements Channel {
  private http: KyInstance;

  constructor(token: string) {
    // POST is not retried by ky by default, which avoids duplicate messages.
    // 429 handling is done by the sender so it can respect retry_after per batch.
    this.http = ky.create({ baseUrl: `https://api.telegram.org/bot${token}/`, timeout: 15_000 });
  }

  async call<T = unknown>(method: string, body: Record<string, unknown>): Promise<TgResponse<T>> {
    try {
      return await this.http.post(method, { json: body }).json<TgResponse<T>>();
    } catch (e) {
      if (e instanceof HTTPError && e.data && typeof e.data === "object") return e.data as TgResponse<T>;
      throw e;
    }
  }

  /**
   * One poster: sendPhoto with the HTML as caption. Several: an album (sendMediaGroup) with the
   * caption on the first photo. No posters, or a caption over the limit: plain sendMessage.
   */
  async send(chatId: number, html: string, photos: string[] = []): Promise<SendResult> {
    const media = photos.slice(0, ALBUM_LIMIT);
    const fitsCaption = html.length <= CAPTION_LIMIT;
    try {
      let r: TgResponse<unknown>;
      if (media.length === 1 && fitsCaption) {
        r = await this.call("sendPhoto", { chat_id: chatId, photo: media[0], caption: html, parse_mode: "HTML" });
      } else if (media.length > 1 && fitsCaption) {
        r = await this.call("sendMediaGroup", {
          chat_id: chatId,
          media: media.map((url, i) => ({
            type: "photo",
            media: url,
            ...(i === 0 ? { caption: html, parse_mode: "HTML" } : {}),
          })),
        });
      } else {
        r = await this.call("sendMessage", {
          chat_id: chatId,
          text: html,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });
      }
      if (r.ok) return { ok: true };
      const desc = r.description ?? "unknown";
      if (r.error_code === 403) return { ok: false, kind: "blocked", error: desc };
      if (r.error_code === 429) return { ok: false, kind: "rate_limited", retryAfter: r.parameters?.retry_after ?? 5, error: desc };
      return { ok: false, kind: "error", error: `${r.error_code}: ${desc}` };
    } catch (e) {
      return { ok: false, kind: "error", error: String(e) };
    }
  }
}

/** Constant-time string compare for secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
