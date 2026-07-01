// ============================================================================
// FXMODUN — fetch-ticks.mjs
// Footprint-д зориулж EURUSD-ийн сүүлийн 3 өдрийн TICK дата татна.
// Гаралт: ./<SYMBOL>/tick/<YYYY-MM-DD>.json  +  ./<SYMBOL>/tick/index.json
// Tick формат: [t(сек), bid, ask] (компакт массив, хэмжээ багасгахын тулд)
//
//   npm i dukascopy-node   (анх удаа л)
//   node fetch-ticks.mjs
// ============================================================================

import { getHistoricalRates } from 'dukascopy-node';
import fs from 'node:fs';
import path from 'node:path';

// ---- ТОХИРГОО --------------------------------------------------------------
const SYMBOLS = [
  { app: 'EURUSD', duka: 'eurusd' },
];
const DAYS = 3;     // сүүлийн хэдэн өдөр
const OUT = '.';
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// сүүлийн N өдрийн [from,to) мужийг өдрөөр нь гаргана (UTC, амралт алгасахгүй — хоосон бол алгасна)
function buildDays() {
  // Тодорхой огноо: 2026-06-17, 18, 19 (replay хүрдэг муж)
  const targets = ['2026-06-17', '2026-06-18', '2026-06-19'];
  return targets.map((label) => {
    const [y, m, d] = label.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const to = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
    return { label, from, to };
  });
}

async function fetchTicks(duka, from, to, attempt = 1) {
  try {
    const data = await getHistoricalRates({
      instrument: duka,
      dates: { from, to },
      timeframe: 'tick',
      format: 'json',
      batchSize: 4,
      pauseBetweenBatchesMs: 1000,
    });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (attempt >= 4) { console.error(`\n   ! ${duka} tick алдаа: ${e.message}`); return null; }
    await sleep(3000 * attempt);
    return fetchTicks(duka, from, to, attempt + 1);
  }
}

function rebuildIndex(dir) {
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
  const chunks = [];
  for (const file of files) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (arr.length) chunks.push({ from: arr[0][0], to: arr[arr.length - 1][0], file, count: arr.length });
    } catch {}
  }
  chunks.sort((a, b) => a.from - b.from);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ chunks }));
  return chunks.length;
}

async function run() {
  const days = buildDays();
  console.log(`Өдөр: ${days.length} (${days[0].label} → ${days[days.length - 1].label})`);

  for (const sym of SYMBOLS) {
    console.log(`\n=== ${sym.app} (tick) ===`);
    const dir = path.join(OUT, sym.app, 'tick');
    fs.mkdirSync(dir, { recursive: true });

    for (const day of days) {
      const p = path.join(dir, `${day.label}.json`);
      if (fs.existsSync(p) && fs.statSync(p).size > 2) { console.log(`  ${day.label}: . (бэлэн)`); continue; }

      process.stdout.write(`  ${day.label}: татаж байна...`);
      const rows = await fetchTicks(sym.duka, day.from, day.to);
      if (rows === null) { console.log(' x (алдаа)'); continue; }

      // dukascopy tick: { timestamp(ms), askPrice, bidPrice, askVolume, bidVolume }
      const ticks = rows
        .map((r) => [
          Math.floor(r.timestamp / 1000),                  // t (сек)
          r.bidPrice ?? r.bid ?? r.price,                  // bid
          r.askPrice ?? r.ask ?? r.price,                  // ask
        ])
        .filter((t) => Number.isFinite(t[0]) && Number.isFinite(t[1]));

      if (ticks.length === 0) { console.log(' o (хоосон)'); continue; }
      fs.writeFileSync(p, JSON.stringify(ticks));
      console.log(` + ${ticks.length} tick`);
      await sleep(300);
    }

    const n = rebuildIndex(dir);
    console.log(`  -> index.json (${n} өдөр)`);
  }

  console.log('\n✅ Дууслаа. <SYMBOL>/tick фолдерыг repo руу хуулж push хий.');
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });
