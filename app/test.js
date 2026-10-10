/* Engine tests: progress safety and the rules that matter. Run: node next/test.js */
const assert = require('assert');
const E = require('./engine.js');
const {loadDeck} = require('./sim.js');
const {deck, global} = loadDeck();
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('PASS', name); };
const at = (d, h) => new Date(2026, 9, 12 + d, h || 19).getTime();
const rnd = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// a phone half-way through the old recognition app
const OLD = {cards: {
  enhance:      {id:'enhance', stage:'review', step:0, ivl:14400, ease:2.5, due:at(1), reps:6, lapses:0},
  compassion:   {id:'compassion', stage:'review', step:0, ivl:2880, ease:2.1, due:at(0), reps:3, lapses:1},
  impact:       {id:'impact', stage:'learning', step:1, ivl:0, ease:2.2, due:at(0), reps:1, lapses:0},
  'gone-word':  {id:'gone-word', stage:'review', step:0, ivl:1440, ease:2.2, due:at(0), reps:2, lapses:0}
}, requests: [{w:'x'}], resetStamp: '2026-09-30-cards-rebuilt', junk: {keep: true}};
const OLD_COPY = JSON.stringify(OLD);

t('import reads the old record and never changes it', () => {
  const S = E.repair(null, at(0));
  const n = E.importOld(S, OLD, deck.map(d => d.word), at(0));
  assert.strictEqual(n, 3);                                  // the deleted word is ignored
  assert.strictEqual(JSON.stringify(OLD), OLD_COPY);
  assert.ok(S.words.enhance.placement && S.words.compassion.placement && S.words.impact.placement);
  assert.strictEqual(S.words.enhance.oldIvlDays, 10);
  assert.strictEqual(E.importOld(S, OLD, deck.map(d => d.word), at(0)), 0);   // only once
});

t('repair keeps unknown fields and fills missing ones', () => {
  const S = E.repair({v:3, words:{enhance:{stage:2, mine:'x'}}, extra:{a:1}}, at(0));
  assert.strictEqual(S.extra.a, 1);
  assert.strictEqual(S.words.enhance.mine, 'x');
  assert.strictEqual(S.words.enhance.stage, 2);
  assert.ok(S.words.enhance.cueLog && typeof S.words.enhance.ease === 'number');
});

t('placement: a fluent hit on a mature word lands at stage 3, a miss restarts it gently', () => {
  const S = E.repair(null, at(0));
  E.importOld(S, OLD, deck.map(d => d.word), at(0));
  const s = new E.Session(S, deck, global, {rnd, now: () => at(0)});
  const probes = s.queue.filter(q => q.kind === 'probe').map(q => q.word);
  assert.deepStrictEqual(probes.slice(0, 2), ['enhance', 'compassion']);      // most mature first
  let c;
  while((c = s.next())){
    if(c.placement && c.word === 'enhance'){ s.answer({ok: true, latency: 900, hints: 0}); continue; }
    if(c.placement && c.word === 'compassion'){ s.answer({ok: false, latency: 9000, hints: 2}); continue; }
    if(c.kind === 'recall') s.answer({ok: true, latency: 2500, hints: 0}); else s.answer({});
  }
  assert.strictEqual(S.words.enhance.stage, 3);
  assert.strictEqual(S.words.compassion.stage, 1);
  assert.strictEqual(S.words.compassion.lapses, 0);        // recognition misses don't carry over, and a placement miss is not a lapse
  assert.ok(!S.words.enhance.placement);
});

t('a new word gets in-session retrievals, then its first test the next day', () => {
  const S = E.repair(null, at(0));
  const s = new E.Session(S, deck, global, {rnd, now: () => at(0)});
  const first = s.queue.find(q => q.kind === 'intro').word;
  let learnCount = 0, c;
  while((c = s.next())){
    if(c.word === first && c.kind === 'recall') learnCount++;
    if(c.kind === 'recall') s.answer({ok: true, latency: 6000, hints: 0}); else s.answer({});
  }
  assert.ok(learnCount >= 2 && learnCount <= 3, 'retrievals: ' + learnCount);
  assert.strictEqual(S.words[first].stage, 1);
  assert.strictEqual(S.words[first].due, E.dayNum(at(0)) + 1);
});

t('confusable neighbours are not introduced together', () => {
  const S = E.repair(null, at(0));
  for(let d = 0; d < 20; d++){
    const s = new E.Session(E.repair(S, at(d)), deck, global, {rnd, now: () => at(d)});
    const batch = s.queue.filter(q => q.kind === 'intro').map(q => q.word);
    batch.forEach(w => batch.forEach(o => { if(w !== o) assert.ok(!s.neighbours(w).includes(o), `${w} with ${o} on day ${d}`); }));
    let c; while((c = s.next())){ if(c.kind === 'recall') s.answer({ok: rnd() < 0.85, latency: 3000, hints: 0}); else s.answer({text: 'x'}); }
  }
});

t('no interval ever exceeds the 10-day cap', () => {
  const {S} = require('./sim.js').run(60, {seed: 3});
  Object.values(S.words).forEach(w => assert.ok(w.ivl <= 10, 'ivl ' + w.ivl));
});

t('a miss on a sentence card does not drop the stage; a miss on a plain cue does', () => {
  const S = E.repair(null, at(0));
  const s = new E.Session(S, deck, global, {rnd, now: () => at(0)});
  Object.assign(s.ws('enhance'), {stage: 3, ivl: 6});
  s.schedule('enhance', 0, {type: 'upgrade'});
  assert.strictEqual(S.words.enhance.stage, 3);
  assert.strictEqual(S.words.enhance.ivl, 1);
  s.schedule('enhance', 0, {type: 'upgrade'});              // two in a row
  assert.strictEqual(S.words.enhance.stage, 2);
  Object.assign(s.ws('impact'), {stage: 3, ivl: 6});
  s.schedule('impact', 0, {type: 'intent'});
  assert.strictEqual(S.words.impact.stage, 2);
});

t('typed answers accept inflections and flag near-misses', () => {
  const e = deck.find(d => d.word === 'exacerbate');
  assert.strictEqual(E.checkTyped(e, 'Exacerbated'), 'right');
  assert.strictEqual(E.checkTyped(e, 'exasperate'), 'wrong');
  assert.strictEqual(E.checkTyped(e, 'exacerbte'), 'close');
});

t('the learner\'s own line hides every form of the word', () => {
  const e = deck.find(d => d.word === 'exacerbate');
  assert.ok(!/exacerbat/i.test(E.hideWord(e, 'My dad always exacerbates it, he exacerbated it again')));
});

console.log(`\n${pass} passed`);
