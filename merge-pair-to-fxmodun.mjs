// ============================================================================
// merge-pair-to-fxmodun.mjs
// fx-data доторх нэг pair-ийн бүх TF файлыг fxmodun руу хуулж (давхцалгүй нэгтгэж),
// index.json-г дахин угсарна. Дараа нь тэр pair-г push хийхэд бэлэн.
//
// Ашиглах: node merge-pair-to-fxmodun.mjs EURCHF
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = 'C:\\Users\\User\\fx-data';
const DST_ROOT = 'C:\\Users\\User\\OneDrive\\Documents\\GitHub\\fxmodun';
const TFS = ['1m','5m','15m','1h','2h','4h','1d','1mo'];

const pair = process.argv[2];
if (!pair) { console.error('Ашиглах: node merge-pair-to-fxmodun.mjs <PAIR>  (ж: EURCHF)'); process.exit(1); }

function rebuildIndex(dir, app, tfId) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').sort();
  const chunks = []; let total = 0, firstTime = null, lastTime = null;
  for (const f of files) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(dir, f),'utf8'));
      if (!arr.length) continue;
      chunks.push({ from: arr[0].time, to: arr[arr.length-1].time, file: f });
      total += arr.length;
      if (firstTime === null) firstTime = arr[0].time;
      lastTime = arr[arr.length-1].time;
    } catch (e) { console.error(`    ${f}: алдаа`, e.message); }
  }
  chunks.sort((a,b)=>a.from-b.from);
  fs.writeFileSync(path.join(dir,'index.json'), JSON.stringify({
    symbol: app, timeframe: tfId, chunkBy: tfId === '1mo' ? 'all' : 'month',
    chunks, firstTime, lastTime, totalCandles: total,
  }));
  return { firstTime, lastTime, total, nFiles: chunks.length };
}

console.log(`\n### ${pair}: fx-data -> fxmodun нэгтгэж байна ###\n`);

for (const tf of TFS) {
  const srcDir = path.join(SRC_ROOT, pair, tf);
  const dstDir = path.join(DST_ROOT, pair, tf);
  if (!fs.existsSync(srcDir)) { console.log(`  ${tf}: fx-data-д алга — алгасав`); continue; }
  fs.mkdirSync(dstDir, { recursive: true });

  // fx-data-ийн сарын файлуудыг fxmodun руу хуулах (давхцвал time-аар нэгтгэх)
  const srcFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.json') && f !== 'index.json');
  let copied = 0, merged = 0;
  for (const f of srcFiles) {
    const srcPath = path.join(srcDir, f);
    const dstPath = path.join(dstDir, f);
    const srcArr = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
    if (fs.existsSync(dstPath)) {
      // давхцсан сар — time-аар нэгтгэх
      const dstArr = JSON.parse(fs.readFileSync(dstPath, 'utf8'));
      const map = new Map();
      for (const c of dstArr) map.set(c.time, c);
      for (const c of srcArr) map.set(c.time, c);
      const out = Array.from(map.values()).sort((a,b)=>a.time-b.time);
      fs.writeFileSync(dstPath, JSON.stringify(out));
      merged++;
    } else {
      fs.copyFileSync(srcPath, dstPath);
      copied++;
    }
  }
  const r = rebuildIndex(dstDir, pair, tf);
  console.log(`  ${tf}: ${copied} хуулсан, ${merged} нэгтгэсэн -> ${r.nFiles} сар, firstTime=${r.firstTime}, lastTime=${r.lastTime}`);
}

console.log(`\n✅ ${pair} бэлэн. GitHub Desktop-д ${pair} фолдерыг commit + push хий.`);
