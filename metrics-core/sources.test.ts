/** Tests für den Zwischenspeicher der Coin-Metrics-CSV. `fetch` wird ersetzt — es geht
 *  kein Request ins Netz. Jeder Test nutzt einen eigenen Asset-Namen, weil der Speicher
 *  für die Laufzeit des Prozesses gilt. */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchCoinMetrics } from './sources';

const CSV = 'time,PriceUSD,ReferenceRateUSD\n2024-01-01,100,\n2024-01-02,110,\n';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

/** Ersetzt fetch; die Antworten werden der Reihe nach vergeben. Liefert den Aufrufzähler. */
function fakeFetch(...antworten: Response[]): { calls: number } {
  const zaehler = { calls: 0 };
  globalThis.fetch = (async () => antworten[zaehler.calls++]) as typeof fetch;
  return zaehler;
}

test('dieselbe CSV wird pro Lauf nur einmal geladen', async () => {
  const f = fakeFetch(new Response(CSV));
  const [a, b] = await Promise.all([fetchCoinMetrics('test-a'), fetchCoinMetrics('test-a')]);
  const c = await fetchCoinMetrics('test-a');
  assert.equal(f.calls, 1);
  assert.deepEqual(a, [['2024-01-01', 100], ['2024-01-02', 110]]);
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});

test('ein Fehlschlag wird nicht gemerkt — der nächste Aufruf versucht es neu', async () => {
  const f = fakeFetch(new Response('', { status: 503 }), new Response(CSV));
  await assert.rejects(fetchCoinMetrics('test-b'), /HTTP 503/);
  assert.equal((await fetchCoinMetrics('test-b')).length, 2);
  assert.equal(f.calls, 2);
});
