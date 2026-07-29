/** Gemeinsame Helfer der Subscriber-Functions. Läuft in Netlify Functions v2 (Web-API). */
import { getStore, Store } from '@netlify/blobs';
import { createHash } from 'node:crypto';

export interface Subscriber {
  email: string;
  status: 'pending' | 'confirmed';
  /** Bestätigungs-Token (einmalig, wird nach Bestätigung gelöscht). */
  confirmToken: string | null;
  /** Stabiles Abmelde-Token — steht später in jeder Wochenmail. */
  unsubToken: string;
  createdAt: string;
  confirmedAt: string | null;
}

export const subscribers = (): Store => getStore('subscribers');
/** Token → Subscriber-Key. Präfixe: c_ = Bestätigung, u_ = Abmeldung. */
export const tokens = (): Store => getStore('tokens');

export const emailKey = (email: string): string =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;

export const siteUrl = (req: Request): string =>
  (process.env['SITE_URL'] ?? new URL(req.url).origin).replace(/\/$/, '');

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const redirect = (to: string): Response =>
  new Response(null, { status: 302, headers: { location: to } });

/** Mailversand über die Resend-REST-API (kein SDK nötig). */
export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env['RESEND_API_KEY'];
  if (!key) throw new Error('RESEND_API_KEY fehlt (Netlify → Site settings → Environment variables)');
  const from = process.env['FROM_EMAIL'] ?? 'Macro Risk Dashboard <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
}

/** Gemeinsames Mail-Layout (Inline-Styles, dunkles Branding). */
export function mailLayout(inner: string, footer: string): string {
  return `<!doctype html><html lang="de"><body style="margin:0;padding:0;background:#0B1220">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:'Segoe UI',system-ui,sans-serif;color:#E8ECF3">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#22C6B8;margin-bottom:14px">Macro Risk Dashboard</div>
    <div style="background:#101A2C;border:1px solid #1D2A42;border-radius:14px;padding:26px 24px;font-size:14.5px;line-height:1.65">
      ${inner}
    </div>
    <div style="font-size:11.5px;color:#5A667E;margin-top:18px;line-height:1.6">
      ${footer}<br>
      Dieser Report ist keine Anlageberatung. Alle Werte sind statistische Modelle ohne Gewähr.
    </div>
  </div></body></html>`;
}
