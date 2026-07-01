// ============================================================================
// verify-pushed.mjs — push хийсэн pair-уудын CDN дээр firstTime 2018 болсныг шалгана
//   node verify-pushed.mjs
// ============================================================================
const CDN = 'https://cdn.jsdelivr.net/gh/tt322738-cpu/fxmodun@main';

// Шалгах pair-ууд (push хийсэн байх ёстой)
const PAIRS = ['EURCHF','EURAUD','EURCAD','EURNZD','GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD','AUDJPY','AUDCHF','AUDCAD'];

const fmt = (s) => s ? new Date(s*1000).toISOString().slice(0,10) : '?';

console.log('CDN шалгаж байна (1h index)...\n');
for (const p of PAIRS) {
  try {
    const res = await fetch(`${CDN}/${p}/1h/index.json`, { cache: 'no-store' });
    if (!res.ok) { console.log(`${p.padEnd(8)} | ХАРИУ ${res.status}`); continue; }
    const idx = await res.json();
    const first = idx.firstTime;
    const year = first ? new Date(first*1000).getUTCFullYear() : 0;
    const ok = year <= 2018 ? '✅ 2018 БОЛСОН' : `⚠️ ${year} (хараахан шинэчлэгдээгүй/кэш)`;
    console.log(`${p.padEnd(8)} | ${fmt(first)} → ${fmt(idx.lastTime)}  ${ok}`);
  } catch (e) {
    console.log(`${p.padEnd(8)} | алдаа: ${e.message}`);
  }
}
console.log('\n⚠️ = CDN кэш хуучин байж магадгүй. purge хийх:');
console.log('   https://purge.jsdelivr.net/gh/tt322738-cpu/fxmodun@main/<PAIR>/1h/index.json');
