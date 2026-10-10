/* Simulates a learner using the v3 engine every day, to check workload, pacing
 * and that no word gets stuck. Not shipped; run with: node next/sim.js [days]
 *
 * The simulated memory: each word has a stability (days). Recall probability
 * after t days is exp(-t / stability). A success multiplies stability (more for
 * a harder-won success, less for an easy one); a miss shrinks it. Latency
 * follows the probability: likely recalls are fast. This is a rough stand-in
 * for a human, good enough to find pacing bugs, not to predict exact numbers.
 */
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const ROOT = path.join(__dirname, '..');

function loadDeck(){
  const csv = fs.readFileSync(path.join(ROOT, 'words.csv'), 'utf8').replace(/^﻿/, '');
  const rows = parseCSV(csv); const head = rows.shift();
  const ctxSrc = fs.readFileSync(path.join(ROOT, 'contexts.js'), 'utf8');
  const CONTEXTS = new Function('window', ctxSrc + ';return window.CONTEXTS;')({});
  let content = {};
  const cdir = path.join(__dirname, 'content');
  fs.readdirSync(cdir).filter(f => /^batch-\d+\.json$/.test(f)).forEach(f => {
    JSON.parse(fs.readFileSync(path.join(cdir, f), 'utf8')).forEach(x => { content[x.word] = x; });
  });
  let global = {};
  try{ global = JSON.parse(fs.readFileSync(path.join(cdir, 'global.json'), 'utf8')); }catch(e){}
  const deck = rows.filter(r => r.length > 1).map(r => {
    const o = {}; head.forEach((h, i) => o[h] = r[i]);
    const c = content[o.word] || stub(o.word);
    return Object.assign({word: o.word, pos: o.part_of_speech, def: o.definition, ru: o.russian_synonyms,
      ex: o.example, contexts: CONTEXTS[o.word] || [o.example],
      themes: (global.word_themes || {})[o.word] || ['t' + (o.word.length % 8)]}, c);
  });
  if(!global.speak) global.speak = [{id:'s1', theme: deck[0].themes[0], prompt:'Talk.'}];
  return {deck, global};
}
function stub(word){
  return {intents:['a','b','c'], ru_cue:'ру', plain:['plain'], upgrades:[{plain:'[x]', better:'*'+word+'*'}],
    collocations:[{chunk: word, frame:'___ x'}], personal:['q '+word, 'who '+word], hook:'h', forms:[word]};
}
function parseCSV(s){
  const out = []; let row = [], f = '', q = false;
  for(let i = 0; i < s.length; i++){
    const ch = s[i];
    if(q){ if(ch === '"'){ if(s[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += ch; }
    else if(ch === '"') q = true;
    else if(ch === ','){ row.push(f); f = ''; }
    else if(ch === '\n'){ row.push(f.replace(/\r$/, '')); out.push(row); row = []; f = ''; }
    else f += ch;
  }
  if(f || row.length){ row.push(f); out.push(row); }
  return out;
}

function run(days, opts){
  opts = opts || {};
  const {deck, global} = loadDeck();
  let seed = opts.seed || 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const start = new Date(2026, 9, 12, 19, 0).getTime();   // 7pm each day
  let S = E.emptyState(start);
  const mem = {};       // word -> {stab, last}
  const report = [];
  let carryUsedRate = 0.4;

  for(let d = 0; d < days; d++){
    const sessions = opts.twice ? [8, 19] : [19];
    let cards = 0, seconds = 0, intros = 0, misses = 0, types = {};
    for(const hour of sessions){
      const now = new Date(2026, 9, 12 + d, hour, 0).getTime();
      S = E.repair(S, now);
      const sess = new E.Session(S, deck, global, {rnd, now: () => now});
      let card;
      while((card = sess.next())){
        const today = E.dayNum(now);
        if(card.kind === 'checkin'){ sess.answer({yes: rnd() < carryUsedRate}); seconds += 4; continue; }
        if(card.kind === 'speak'){ sess.answer({used: card.words.filter(() => rnd() < 0.6)}); seconds += 70; continue; }
        if(card.kind === 'carry'){ sess.answer({}); seconds += 5; continue; }
        if(card.kind === 'intro'){
          mem[card.word] = {stab: 0.3, last: now}; sess.answer({}); intros++; seconds += 35; continue;
        }
        if(card.kind === 'hook'){ mem[card.word].stab *= 1.5; sess.answer({}); seconds += 10; continue; }
        if(card.kind === 'personal-ask'){ sess.answer({text: 'my sister'}); seconds += 20; continue; }
        const m = mem[card.word] || (mem[card.word] = {stab: 2, last: now - 3*864e5});
        const tDays = Math.max(0.01, (now - m.last) / 864e5);
        // harder card types are a bit harder to recall
        const typeK = {ru:1.2, intent:1, cloze:1.1, colloc:1.05, upgrade:0.9, contrast:1.1, personal:1.15}[card.type] || 1;
        let p = Math.exp(-tDays / (m.stab * typeK));
        if(card.typed) p *= 0.9;
        const ok = rnd() < p;
        const latency = ok ? 1500 + (1 - p) * 9000 * rnd() : 12000;
        const hints = ok && p < 0.5 && rnd() < 0.5 ? 1 : 0;
        const g = sess.answer({ok, latency, hints});
        types[card.type] = (types[card.type] || 0) + 1;
        // memory update
        if(ok){ m.stab *= (1.8 + (1 - p) * 2.2); } else { m.stab = Math.max(0.3, m.stab * 0.45); misses++; }
        m.last = now;
        cards++; seconds += card.typed ? 14 : 9;
      }
    }
    const sum = new E.Session(S, deck, global, {rnd, now: () => new Date(2026, 9, 12 + d, 23, 0).getTime()}).summary();
    report.push({day: d + 1, cards, intros, misses, minutes: +(seconds / 60).toFixed(1), stages: sum.byStage.join('/'), types});
  }
  return {report, S, mem, deck};
}

if(require.main === module){
  const days = +process.argv[2] || 60;
  const twice = process.argv.includes('--twice');
  const {report, S, deck} = run(days, {twice});
  console.log('day  cards intro miss  min   stages new/meet/recall/use/own/free');
  report.forEach(r => console.log(String(r.day).padStart(3), String(r.cards).padStart(6), String(r.intros).padStart(5),
    String(r.misses).padStart(5), String(r.minutes).padStart(5), '  ', r.stages));
  const tot = report.reduce((a, r) => { Object.entries(r.types).forEach(([k, v]) => a[k] = (a[k] || 0) + v); return a; }, {});
  console.log('card types overall:', JSON.stringify(tot));
  const stuck = deck.filter(e => { const w = S.words[e.word]; return w && w.stage >= 1 && w.stage <= 2 && w.introDay >= 0 && (E.dayNum(Date.now()) - w.introDay) > 30; });
  console.log('avg minutes/day:', (report.reduce((a, r) => a + r.minutes, 0) / report.length).toFixed(1));
}
module.exports = {run, loadDeck};
