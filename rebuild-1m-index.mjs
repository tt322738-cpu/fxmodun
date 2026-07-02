// ============================================================================
//  rebuild-1m-index.mjs  —  fxmodun repo дотор 1m/index.json-ыг ЗӨВХӨН
//  байгаа 2018-01.json ... 2026-06.json файлуудаас дахин угсарна.
//
//  Ажил гэсэн зөвхөн НЭГ файл: <PAIR>/1m/index.json.
//  Бусад timeframe-д (5m/15m/1h/2h/4h/1d/1mo) огт хүрэхгүй.
//
//  Ашиглах (repo фолдер дотор):
//      node rebuild-1m-index.mjs EURUSD
//      node rebuild-1m-index.mjs EURUSD --dry-run     (өөрчлөхгүй, хараад л дуусна)
//
//  Санамж: одоогийн ажиллаж байгаа pair-үүдийн 1m/index.json-ы форматтай ижил
//  бүтэц үүсгэнэ:
//    { symbol, timeframe:"1m", chunkBy:"month",
//      chunks:[{file, from, to, count}, ...],
//      firstTime, lastTime, totalCandles }
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

const PAIR = process.argv[2];
const DRY  = process.argv.includes('--dry-run');
if (!PAIR) { console.error('Ашиглах: node rebuild-1m-index.mjs <PAIR> [--dry-run]'); process.exit(1); }

const dir = path.join(process.cwd(), PAIR, '1m');
if (!fs.existsSync(dir)) {
  console.error(`ЗАМ АЛГА: ${dir}\n(repo фолдер дотроос ажиллуулж байна уу?)`);
  process.exit(1);
}

// зөвхөн YYYY-MM.json файлуудыг сонго (index.json болон бусад биш)
const monthRe = /^(\d{4})-(\d{2})\.json$/;
const files = fs.readdirSync(dir).filter(f => monthRe.test(f)).sort();

if (!files.length) {
  console.error(`1m сарын файл олдсонгүй: ${dir}`);
  process.exit(1);
}

console.log(`### ${PAIR}/1m/index.json дахин угсарч байна ###`);
console.log(`фолдер: ${dir}`);
console.log(`олдсон сарын файл: ${files.length}\n`);

const chunks = [];
let total = 0, firstTime = null, lastTime = null;
let bad = 0;

for (const f of files) {
  const p = path.join(dir, f);
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!Array.isArray(arr) || arr.length === 0) {
      console.log(`  · ${f}  (хоосон, алгасана)`);
      continue;
    }
    const from = arr[0].time;
    const to   = arr[arr.length - 1].time;
    if (typeof from !== 'number' || typeof to !== 'number') {
      console.log(`  ✗ ${f}  (time талбар буруу, алгасана)`);
      bad++;
      continue;
    }
    chunks.push({ file: f, from, to });
    total += arr.length;
    if (firstTime === null) firstTime = from;
    lastTime = to;
  } catch (e) {
    console.log(`  ✗ ${f}  ${e.message.slice(0, 60)}`);
    bad++;
  }
}

chunks.sort((a, b) => a.from - b.from);

const idx = {
  symbol: PAIR,
  timeframe: '1m',
  chunkBy: 'month',
  chunks,
  firstTime,
  lastTime,
  totalCandles: total,
};

const fmt = (s) => s ? new Date(s * 1000).toISOString().slice(0, 16).replace('T',' ') : '—';
console.log(`\n=> chunk: ${chunks.length}, нийт lаа: ${total.toLocaleString()}`);
console.log(`   эхлэл: ${fmt(firstTime)}  →  төгсгөл: ${fmt(lastTime)}`);
if (bad) console.log(`   ⚠ алдаатай/алгассан файл: ${bad}`);

const outPath = path.join(dir, 'index.json');
if (DRY) {
  console.log(`\n(dry-run) бичээгүй. --dry-run-гүйгээр ажиллуулбал: ${outPath}`);
} else {
  fs.writeFileSync(outPath, JSON.stringify(idx));
  console.log(`\n✅ бичсэн: ${outPath}`);
  console.log(`Дараа: GitHub Desktop -> зөвхөн ${PAIR}/1m/index.json өөрчлөгдсөн байх ёстой.`);
}
