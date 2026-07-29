/** Täglicher Snapshot-Build (GitHub Actions).
 *  Robustheit: Ausgefallene Feeds übernehmen ihre letzten guten Werte aus dem vorigen Snapshot
 *  (mit ehrlich wachsendem staleDays) — die Seite verliert nie Karten, sondern altert sichtbar.
 *  Qualitäts-Gate VOR jedem Schreiben: ein kaputter Lauf fasst den letzten guten Stand nicht an. */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { buildSnapshot } from '../metrics-core/snapshot';
import { NODE_CTX } from '../metrics-core/sources';
import { Snapshot } from '../metrics-core/types';

const ARCHIVE_KEEP = 90;
const MIN_FRESH = 3; // unter 3 frisch geladenen Metriken gilt der Lauf als Totalausfall

async function main(): Promise<void> {
  const snap = await buildSnapshot(NODE_CTX);
  const fresh = snap.metrics.length;

  if (fresh < MIN_FRESH) {
    console.error(`Nur ${fresh} Metriken frisch geladen (< ${MIN_FRESH}) — Totalausfall, es wird NICHTS geschrieben.`);
    process.exit(1);
  }

  // Carry-over: Lücken dieses Laufs mit dem letzten guten Stand füllen
  let prev: Snapshot | null = null;
  if (existsSync('public/snapshot.json')) {
    try { prev = JSON.parse(readFileSync('public/snapshot.json', 'utf8')) as Snapshot; }
    catch { prev = null; }
  }
  let carried = 0;
  if (prev) {
    const have = new Set(snap.metrics.map(m => m.id));
    for (const old of prev.metrics) {
      if (have.has(old.id)) continue;
      old.current.staleDays = Math.max(0, Math.round((Date.now() - new Date(old.current.date).getTime()) / 864e5));
      snap.metrics.push(old);
      carried++;
    }
    if (!snap.derived.bubble && prev.derived.bubble) snap.derived.bubble = prev.derived.bubble;
    if (!snap.derived.bear && prev.derived.bear) snap.derived.bear = prev.derived.bear;
    if (snap.derived.ratios.length === 0 && prev.derived.ratios.length) snap.derived.ratios = prev.derived.ratios;
  }

  const json = JSON.stringify(snap);
  writeFileSync('public/snapshot.json', json);
  mkdirSync('data/archive', { recursive: true });
  writeFileSync(`data/archive/${snap.generatedAt.slice(0, 10)}.json`, json);
  const files = readdirSync('data/archive').filter(f => f.endsWith('.json')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - ARCHIVE_KEEP))) rmSync(`data/archive/${f}`);

  console.log(`Snapshot: ${fresh} frisch, ${carried} aus Vortag übernommen, ${(json.length / 1024).toFixed(0)} KB` +
    (snap.failed.length ? ` · ausgefallen: ${snap.failed.join(', ')}` : ''));

  // Frischeprüfung: veraltete Kurse sind der häufigste stille Fehler — hier laut machen
  const stale = snap.metrics.filter(m => m.current.staleDays > 5)
    .sort((a, b) => b.current.staleDays - a.current.staleDays);
  if (stale.length) {
    console.warn('\n⚠ Veraltete Kurse (> 5 Tage):');
    for (const m of stale) console.warn(`   ${m.id.padEnd(20)} ${m.current.date}  (${m.current.staleDays} Tage alt)`);
    console.warn('   Ursache meist: Quelle blockiert (Ratelimit/Geo) oder Anbieter liefert selbst veraltet.\n');
  } else {
    console.log('✓ Alle Kurse aktuell (≤ 5 Tage).');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
