// ============================================================================
// fetch-recent-all-tf.mjs
// EURUSD-ийн сүүлийн N өдрийн бүх timeframe-г татаж, ОДОО БАЙГАА файлд НЭГТГЭНЭ.
// (дарж бичихгүй — давхцлыг time-аар арилгана)
// Зорилго: бүх TF 06-19-д зогссоныг 06-29 хүртэл сунгах -> replay цааш явна.
//
//   node fetch-recent-all-tf.mjs
// ============================================================================
import { getHistoricalRates } from 'dukascopy-node';
import fs from 'node:fs';
import path from 'node:path';

const SYMBOL = { app: 'EURUSD', duka: 'eurusd' };
const DAYS = 12;        // сүүлийн хэдэн өдөр (06-17 орчмоос 06-29) — давхцал OK
const OUT = '.';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// app TF id -> dukascopy timeframe + chunk бүлэглэх арга + файлын нэр
const TFS = [
  { id: '5m',  duka: 'm5',  chunkBy: 'year'  },
  { id: '15m', duka: 'm15', chunkBy: 'year'  },
  { id: '1h',  duka: 'h1',  chunkBy: 'year'  },
  { id: '4h',  duka: 'h4',  chunkBy: 'year'  },
  { id: '1d',  duka: 'd1',  chunkBy: 'all'   },
  // 2h байхгүй (dukascopy) — h1-ээс aggregate хийдэг тул алгасав
  // 1m аль хэдийн шинэчилсэн
];

function isWeekendFiller(sec) {
  const d = new Date(sec * 1000);
  const day = d.getUTCDay(), h = d.getUTCHours();
  if (day === 6) return true;
  if (day === 0 && h < 22) return true;
  if (day === 5 && h >= 22) return true;
  return false;
}

async function fetchRange(duka, tf, from, to, attempt = 1) {
  try {
    const data = await getHistoricalRates({
      instrument: duka, dates: { from, to },
      timeframe: tf, format: 'json',
      batchSize: 10, pauseBetweenBatchesMs: 800,
    });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (attempt === 1) console.error('    (оролдлого 1 алдаа):', e && (e.message || e.toString()));
    if (attempt >= 4) { console.error('    ! алдаа:', e && (e.message || e.toString() || JSON.stringify(e))); return []; }
    await sleep(3000 * attempt);
    return fetchRange(duka, tf, from, to, attempt + 1);
  }
}

function chunkKey(sec, chunkBy) {
  const d = new Date(sec * 1000);
  if (chunkBy === 'all') return 'all';
  if (chunkBy === 'year') return String(d.getUTCFullYear());
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; // month
}

async function run() {
  const now = new Date();
  const to = now;
  const from = new Date(now.getTime() - DAYS * 86400000);
  console.log(`Татах муж: ${from.toISOString().slice(0,10)} → ${to.toISOString().slice(0,10)}\n`);

  for (const tf of TFS) {
    console.log(`=== ${tf.id} (${tf.duka}) ===`);
    const raw = await fetchRange(SYMBOL.duka, tf.duka, from, to);
    const candles = raw
      .map(r => ({ time: Math.floor(r.timestamp/1000), open:r.open, high:r.high, low:r.low, close:r.close }))
      .filter(c => Number.isFinite(c.time) && Number.isFinite(c.open) && !isWeekendFiller(c.time));
    console.log(`  татсан: ${raw.length}, filler хассаны дараа: ${candles.length}`);
    if (candles.length === 0) { console.log('  дата алга — алгасав\n'); continue; }

    const dir = path.join(OUT, SYMBOL.app, tf.id);
    fs.mkdirSync(dir, { recursive: true });

    // chunk бүлэглэх
    const byChunk = new Map();
    for (const c of candles) {
      const key = chunkKey(c.time, tf.chunkBy);
      if (!byChunk.has(key)) byChunk.set(key, []);
      byChunk.get(key).push(c);
    }

    for (const [key, newCandles] of byChunk) {
      const file = path.join(dir, `${key}.json`);
      let existing = [];
      if (fs.existsSync(file)) { try { existing = JSON.parse(fs.readFileSync(file,'utf8')); } catch {} }
      const map = new Map();
      for (const c of existing) map.set(c.time, c);   // хуучин
      for (const c of newCandles) map.set(c.time, c); // шинэ (давхцлыг дарна)
      const merged = Array.from(map.values()).sort((a,b)=>a.time-b.time);
      fs.writeFileSync(file, JSON.stringify(merged));
      console.log(`  ${key}.json: ${existing.length} → ${merged.length}`);
    }

    // index.json дахин угсрах
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').sort();
    const chunks = []; let total = 0, firstTime = null, lastTime = null;
    for (const f of files) {
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(dir, f),'utf8'));
        if (!arr.length) continue;
        chunks.push({ file: f, from: arr[0].time, to: arr[arr.length-1].time, count: arr.length });
        total += arr.length;
        if (firstTime === null) firstTime = arr[0].time;
        lastTime = arr[arr.length-1].time;
      } catch {}
    }
    chunks.sort((a,b)=>a.from-b.from);
    fs.writeFileSync(path.join(dir,'index.json'), JSON.stringify({
      symbol: SYMBOL.app, timeframe: tf.id, chunkBy: tf.chunkBy,
      chunks, firstTime, lastTime, totalCandles: total,
    }));
    console.log(`  -> index.json lastTime=${lastTime}\n`);
    await sleep(500);
  }

  console.log('✅ Бүх TF шинэчлэгдлээ. EURUSD фолдерыг repo руу push хий.');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
