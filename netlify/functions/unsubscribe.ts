/** GET /api/unsubscribe?t=… · Meldet ab und löscht alle gespeicherten Daten (DSGVO). */
import type { Config } from '@netlify/functions';
import { redirect, subscribers, tokens, Subscriber } from './_shared';

export default async (req: Request): Promise<Response> => {
  const t = new URL(req.url).searchParams.get('t');
  if (!t) return redirect('/report?status=fehler');

  const tok = tokens();
  const key = await tok.get('u_' + t, { type: 'text' });
  if (!key) return redirect('/report?status=abgemeldet'); // Token unbekannt/schon gelöscht → gleiche Zielseite

  const store = subscribers();
  const sub = (await store.get(key, { type: 'json' })) as Subscriber | null;
  await store.delete(key);
  await tok.delete('u_' + t);
  if (sub?.confirmToken) await tok.delete('c_' + sub.confirmToken);

  return redirect('/report?status=abgemeldet');
};

export const config: Config = { path: '/api/unsubscribe' };
