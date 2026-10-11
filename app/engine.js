/* Vocab v3 engine: everything that decides what the learner sees next.
 *
 * No DOM in here. index.html renders whatever card the session hands it and
 * reports back one result. Every decision (which word, which kind of card, which
 * cue, when it comes back, when new words arrive) is made here, so the learner
 * never chooses anything. DESIGN.md explains the reasoning behind each rule.
 *
 * Runs in the browser (window.VocabEngine) and under node for tests.
 */
(function(root){
'use strict';

/* ------------------------------------------------------------------ tuning */
const T = {
  MAX_IVL_DAYS: 10,         // Elijah's standing rule: nothing waits longer than 10 days
  SESSION_CARDS: 45,        // budget per session (~11 min), new-word repeats included
  NEW_PER_SESSION: 5,
  NEW_PER_DAY: 8,
  NEW_COST: 4,              // an introduction plus its in-session repeats
  PROBE_COST: 2,
  PROBES_PER_DAY: 10,       // placement checks for words imported from the old app
  BACKLOG_STOP: 40,         // no new words while this many reviews are due
  WEEK_LOAD_MAX: 32,        // ...or while the next 7 days average more than this
  FAMILY_HOLD_DAYS: 7,      // a confusable neighbour must be this old...
  FAMILY_HOLD_MAX: 10,      // ...and never holds a word back longer than this
  LEARN_GAPS: [2, 5, 10],   // in-session retrievals of a new word, cards later
  LEARN_MAX_ATTEMPTS: 5,
  MISS_REQUEUE: 3,
  HOOK_LAPSES: 4,           // memory hook offered
  REINTRO_LAPSES: 7,        // full re-introduction with a different anchor
  CUE_RETIRE_MISSES: 3,     // a cue missed this often is probably not diagnostic
  CUE_GAP: 3,               // a cue doesn't repeat within this many reviews of its word
  TYPED_EVERY: 4,
  TYPED_EVERY_STRICT: 2,    // when self-marking runs ahead of typed accuracy
  CALIBRATION_GAP: 0.15,
  SLOW_NO_PROMOTE_MS: 20000,
  LAT_DISCARD_MS: 45000,
  EASE0: 2.3, EASE_MIN: 1.3, EASE_MAX: 2.8,
  ROLLOVER_HOURS: 4,
  SPEAK_MIN_WORDS: 3,
  CARRY_GAP_DAYS: 3,
  ASKS_PER_SESSION: 2        // personal questions mean typing, so only a couple per session
};

const STAGE = {NEW:0, MEET:1, RECALL:2, USE:3, OWN:4, FREE:5};
const STAGE_NAMES = ['new','meet','recall','use','own','free'];
const CORE_TYPES = ['intent','ru','cloze','probe'];   // a miss on these says the word itself is weak

/* -------------------------------------------------------------- time utils */
function dayNum(ts){
  const d = new Date(ts - T.ROLLOVER_HOURS*3600e3);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
}

/* ---------------------------------------------------------------- helpers */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
function pickWeighted(items, rnd){
  const total = items.reduce((s, x) => s + x.w, 0);
  if(total <= 0) return null;
  let r = rnd() * total;
  for(const x of items){ r -= x.w; if(r <= 0) return x.v; }
  return items[items.length-1].v;
}
function shuffle(a, rnd){
  a = a.slice();
  for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function norm(s){
  return String(s||'').toLowerCase().replace(/[‘’]/g, "'")
    .replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim();
}
function lev(a, b){
  const m = a.length, n = b.length;
  if(Math.abs(m-n) > 2) return 3;
  let prev = Array.from({length:n+1}, (_, j) => j);
  for(let i = 1; i <= m; i++){
    const cur = [i];
    for(let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1] + (a[i-1]===b[j-1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function percentile(arr, p){
  if(!arr.length) return NaN;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
function formsOf(entry){
  return [entry.word].concat(entry.forms || []).filter(Boolean)
    .sort((a, b) => b.length - a.length);
}
/* Hides every form of the word in a line of text (the learner's own answer,
   a question), so an inflection doesn't give it away. */
function hideWord(entry, text){
  let out = String(text || '');
  formsOf(entry).forEach(f => { out = out.replace(new RegExp('\\b' + escapeRe(f) + '\\b', 'gi'), '_____'); });
  return out;
}
/* Typed answers are checked against every accepted form. One slip in a long
   word is "close": the spelling is shown and it counts as hard. */
function checkTyped(entry, typed){
  const t = norm(typed);
  if(!t) return 'wrong';
  const forms = formsOf(entry).map(norm);
  if(forms.includes(t)) return 'right';
  const tol = t.length >= 9 ? 2 : t.length >= 5 ? 1 : 0;
  if(tol && forms.some(f => lev(f, t) <= tol)) return 'close';
  return 'wrong';
}
/* A gap shows the first letter of the hidden span, as in the standard
   controlled-production test: it stops synonyms from fitting the blank. */
function gapWithLetter(sentence){
  return String(sentence).replace(/\*([^*]+)\*/, (m, span) =>
    span.split(' ').map(w => w[0] + '_'.repeat(Math.max(2, w.length - 1))).join(' '));
}
/* "___ evidence" fits several words; "c_______ evidence" fits one. The missing
   span is whatever the chunk has where the frame has its gap. */
function frameWithLetter(c){
  const frame = String(c.frame || ''), chunk = String(c.chunk || '');
  const at = frame.indexOf('___');
  if(at < 0) return frame;
  const pre = frame.slice(0, at), post = frame.slice(at + 3);
  let span = chunk;
  if(pre && chunk.toLowerCase().startsWith(pre.toLowerCase())) span = span.slice(pre.length);
  if(post && span.toLowerCase().endsWith(post.toLowerCase())) span = span.slice(0, span.length - post.length);
  span = span.trim();
  if(!span || span.length > chunk.length) return frame;
  const gap = span.split(' ').map(w => w[0] + '_'.repeat(Math.max(2, w.length - 1))).join(' ');
  return pre + gap + post;
}
function gapPlain(sentence){ return String(sentence).replace(/\*[^*]+\*/, '_____'); }

/* Hints come from the sound of the word, never its meaning, and appear on
   their own when the learner is slow. At the very first stage the Russian is
   a last resort. */
function hintSteps(entry, stage, cueIsRussian){
  const w = entry.word, words = w.split(' ');
  const first = s => (/^(ch|sh|th|ph|wh|qu)/i.test(s) ? s.slice(0,2) : s.slice(0,1));
  const mask = s => s.replace(/[a-z]/gi, '_');
  let h1, h2;
  if(words.length > 1){
    h1 = words.map(x => first(x) + mask(x.slice(first(x).length))).join(' ');
    h2 = words.map((x, i) => i === 0 ? x : first(x) + mask(x.slice(first(x).length))).join(' ');
  } else {
    h1 = first(w) + mask(w.slice(first(w).length));
    const syl = (w.match(/^[^aeiouy]*[aeiouy]+[^aeiouy]?/i) || [w.slice(0,3)])[0];
    h2 = syl + mask(w.slice(syl.length));
  }
  const out = [h1, h2];
  if(stage <= STAGE.MEET && !cueIsRussian && entry.ru) out.push(entry.ru);
  return out;
}

/* ------------------------------------------------------------------ state */
function emptyState(now){
  return {v:3, created: now, words: {}, day: {n: dayNum(now)}, lat: {}, cal: {self: [], typed: []}, history: {}};
}
function wordState(){
  return {stage: STAGE.NEW, due: 0, ivl: 0, ease: T.EASE0, reps: 0, lapses: 0, consecMiss: 0,
          streak: 0, lastOkDay: -1, lastDay: -1, typedOk: false, probeOk: 0,
          cueLog: {}, cueMiss: {}, lastType: '', used: 0, lastUsedDay: -1, introDay: -1,
          personal: null, hookShown: false, reintroDone: false, lastCarryDay: -99,
          placement: false, oldIvlDays: 0};
}
/* Repairs whatever it finds and keeps unknown fields, like the old app. */
function repair(S, now){
  if(!S || typeof S !== 'object' || S.v !== 3) S = emptyState(now);
  if(!S.words || typeof S.words !== 'object') S.words = {};
  if(!S.day || typeof S.day !== 'object') S.day = {n: dayNum(now)};
  if(!S.lat || typeof S.lat !== 'object' || Array.isArray(S.lat)) S.lat = {};
  if(!S.cal || typeof S.cal !== 'object') S.cal = {self: [], typed: []};
  if(!S.history || typeof S.history !== 'object') S.history = {};
  Object.keys(S.words).forEach(k => { S.words[k] = Object.assign(wordState(), S.words[k]); });
  rollDay(S, now);
  return S;
}
function rollDay(S, now){
  const n = dayNum(now);
  if(S.day.n === n) return;
  const prev = S.day;
  S.day = {n, newCount: 0, probeCount: 0, speakDone: false, carry: null, checkin: null};
  if(prev && prev.carry && prev.n === n - 1) S.day.checkin = prev.carry;   // yesterday's carry word
}

/* Words reviewed in the old recognition app are known on sight, which says
   little about producing them. Each gets one placement check the first time
   it comes up; until then it waits, without blocking anything. The old record
   is only ever read. */
function importOld(S, old, deckWords, now){
  if(S.importedAt) return 0;
  S.importedAt = now;
  if(!old || !old.cards) return 0;
  const have = new Set(deckWords);
  let n = 0;
  Object.keys(old.cards).forEach(id => {
    const c = old.cards[id];
    if(!c || !have.has(c.id) || !((c.reps || 0) > 0)) return;
    const w = Object.assign(wordState(), S.words[c.id] || {});
    if(w.stage !== STAGE.NEW) return;
    w.placement = true;
    w.oldIvlDays = (Number(c.ivl) || 0) / 1440;
    w.ease = clamp(Number(c.ease) || T.EASE0, T.EASE_MIN, T.EASE_MAX);
    S.words[c.id] = w;
    n++;
  });
  return n;
}

/* ------------------------------------------------------------ the session */
function Session(S, deck, global, opts){
  opts = opts || {};
  this.S = S;
  this.deck = deck;
  this.byWord = {};
  deck.forEach((e, i) => { e.order = i; this.byWord[e.word] = e; });
  this.global = global || {};
  this.rnd = opts.rnd || Math.random;
  this.now = opts.now || (() => Date.now());
  this.extra = !!opts.extra;
  this.families = (this.global.families || []).map(f => f.words);
  this.learn = {};     // word -> {succ, attempts, lastG} for words met this session
  this.queue = [];
  this.done = 0;
  this.build();
}

Session.prototype.ws = function(word){
  if(!this.S.words[word]) this.S.words[word] = wordState();
  return this.S.words[word];
};
Session.prototype.today = function(){ return dayNum(this.now()); };

Session.prototype.neighbours = function(word){
  const out = new Set();
  this.families.forEach(f => { if(f.includes(word)) f.forEach(x => { if(x !== word) out.add(x); }); });
  return [...out];
};

/* Words due, riskiest first: a day overdue on a one-day interval is far more
   likely to be lost than two days overdue on a ten-day one. */
Session.prototype.dueWords = function(horizon){
  const today = this.today(), t = today + (horizon || 0);
  const risk = w => (today - (w.lastDay >= 0 ? w.lastDay : today - 1)) / Math.max(1, w.ivl);
  return this.deck.filter(e => {
    const w = this.S.words[e.word];
    return w && w.stage >= STAGE.MEET && w.due <= t;
  }).sort((a, b) => {
    const wa = this.S.words[a.word], wb = this.S.words[b.word];
    return (risk(wb) - risk(wa)) || (wa.stage - wb.stage) || (a.order - b.order);
  });
};

Session.prototype.weekLoad = function(){
  const today = this.today();
  let total = 0;
  for(let d = 1; d <= 7; d++){
    this.deck.forEach(e => { const w = this.S.words[e.word]; if(w && w.stage >= 1 && w.due <= today + d && w.due > today + d - 1) total++; });
  }
  return total / 7;
};

/* A word waits while a confusable neighbour is still fresh: introduced less
   than a week ago, or not yet past its first next-day test. Never longer than
   ten days, so a struggling neighbour can't freeze its family. */
Session.prototype.held = function(word, picked){
  const today = this.today();
  return this.neighbours(word).some(o => {
    if(picked.includes(o)) return true;
    const w = this.S.words[o];
    if(!w || w.stage === STAGE.NEW || w.introDay < 0) return false;
    const age = today - w.introDay;
    if(age >= T.FAMILY_HOLD_MAX) return false;
    return age < T.FAMILY_HOLD_DAYS || w.stage < STAGE.RECALL;
  });
};

Session.prototype.pickProbes = function(slots){
  const S = this.S;
  const left = T.PROBES_PER_DAY - (S.day.probeCount || 0);
  const n = Math.min(left, Math.floor(slots / T.PROBE_COST));
  if(n <= 0) return [];
  // most mature first, for quick wins in the first days
  return this.deck.filter(e => { const w = S.words[e.word]; return w && w.placement; })
    .sort((a, b) => S.words[b.word].oldIvlDays - S.words[a.word].oldIvlDays)
    .slice(0, n).map(e => e.word);
};

Session.prototype.pickNew = function(slots, dueCount){
  const S = this.S;
  if(dueCount >= T.BACKLOG_STOP) return [];
  if(!this.extra && this.weekLoad() > T.WEEK_LOAD_MAX) return [];
  const dayLeft = this.extra ? T.NEW_PER_SESSION : T.NEW_PER_DAY - (S.day.newCount || 0);
  const room = clamp(Math.floor(slots / T.NEW_COST), 0, Math.min(T.NEW_PER_SESSION, dayLeft));
  if(room <= 0) return [];
  const fresh = this.deck.filter(e => { const w = S.words[e.word]; return !w || (w.stage === STAGE.NEW && !w.placement); });
  const themeOf = e => (e.themes && e.themes[0]) || '';
  const picked = [];
  const lead = fresh.find(e => !this.held(e.word, []));
  if(!lead) return [];
  const add = e => { if(picked.length < room && !picked.includes(e.word) && !this.held(e.word, picked)) picked.push(e.word); };
  fresh.filter(e => themeOf(e) === themeOf(lead)).forEach(add);   // one theme leads the batch
  if(picked.length < room) fresh.forEach(add);                     // top up from the deck order
  return picked;
};

Session.prototype.build = function(){
  const S = this.S, q = [];
  if(S.day.checkin && this.byWord[S.day.checkin.word]) q.push({kind:'checkin', word: S.day.checkin.word});
  const allDue = this.dueWords(this.extra ? 1 : 0);
  const reviews = allDue.slice(0, T.SESSION_CARDS).map(e => ({kind:'review', word: e.word}));
  let slots = T.SESSION_CARDS - reviews.length;
  if(this.extra) slots = Math.max(slots, T.NEW_COST * 3);
  const probes = this.pickProbes(slots).map(w => ({kind:'probe', word: w}));
  slots -= probes.length * T.PROBE_COST;
  const intros = this.pickNew(slots, allDue.length).map(w => ({kind:'intro', word: w}));
  // a short warm-up, then something new every few cards
  const fresh = probes.concat(intros);
  const mixed = reviews.slice(0, 2);
  let r = 2, i = 0;
  while(r < reviews.length || i < fresh.length){
    if(i < fresh.length) mixed.push(fresh[i++]);
    mixed.push(...reviews.slice(r, r + 3)); r += 3;
  }
  this.queue = q.concat(mixed);
  this.tailAdded = false;
};

Session.prototype.addTail = function(){
  if(this.tailAdded) return;
  this.tailAdded = true;
  const S = this.S;
  const atLeast = s => this.deck.filter(e => { const w = S.words[e.word]; return w && w.stage >= s; });
  if(!S.day.speakDone && atLeast(STAGE.RECALL).length >= T.SPEAK_MIN_WORDS && (this.global.speak || []).length)
    this.queue.push({kind:'speak'});
  if(!S.day.carry && atLeast(STAGE.USE).length) this.queue.push({kind:'carry'});
};

Session.prototype.insertAt = function(offset, item){
  this.queue.splice(Math.min(this.queue.length, offset), 0, item);
};

/* ------------------------------------------------------------------- cues */
/* Every way a word can be cued, each with an id so the app can rotate through
   them least-recently-used. One intent and two sentences are held back and only
   ever used as probes: they are the honest test of whether the word comes to
   mind from a cue the learner has never practised. */
function cuesFor(entry, w){
  const cues = [];
  const ints = entry.intents || [];
  const heldIntent = ints.length >= 3 ? ints.length - 1 : -1;
  ints.forEach((t, i) => cues.push({id: (i === heldIntent ? 'pi' : 'i') + i, type: i === heldIntent ? 'probe' : 'intent', text: t}));
  if(entry.ru_cue) cues.push({id: 'r', type: 'ru', text: entry.ru_cue});
  (entry.upgrades || []).forEach((u, i) => cues.push({id: 'u' + i, type: 'upgrade', text: u.plain, answer: u.better}));
  (entry.collocations || []).forEach((c, i) => cues.push({id: 'k' + i, type: 'colloc', text: frameWithLetter(c), answer: c.chunk}));
  const ctx = entry.contexts || [];
  const heldCtx = ctx.length >= 6 ? [ctx.length - 1, ctx.length - 2] : [];
  ctx.forEach((s, i) => {
    if(s === entry.ex) return;   // the anchor sentence was shown at introduction
    const probe = heldCtx.includes(i);
    cues.push({id: (probe ? 'pc' : 'c') + i, type: probe ? 'probe' : 'cloze', text: gapWithLetter(s), answer: s, cloze: true});
  });
  if(w.personal && w.personal.a)
    cues.push({id: 'p', type: 'personal', text: hideWord(entry, w.personal.q), mine: hideWord(entry, w.personal.a)});
  return cues;
}

const WEIGHTS = {
  1: {ru: 3, intent: 3, upgrade: 2, colloc: 1},
  2: {intent: 3, upgrade: 3, colloc: 2, cloze: 2, ru: 0.5, personal: 2},
  3: {intent: 2, upgrade: 3, colloc: 2, cloze: 1, contrast: 3, personal: 2},
  4: {intent: 2, upgrade: 3, colloc: 2, cloze: 1, contrast: 2, personal: 2, probe: 1.5},
  5: {intent: 2, upgrade: 2, colloc: 1, cloze: 1, contrast: 2, personal: 2, probe: 2.5}
};

Session.prototype.typedEvery = function(){
  const c = this.S.cal, rate = a => a.reduce((s, x) => s + x, 0) / a.length;
  if(c.self.length >= 10 && c.typed.length >= 10 && rate(c.self) - rate(c.typed) > T.CALIBRATION_GAP)
    return T.TYPED_EVERY_STRICT;
  return T.TYPED_EVERY;
};

/* Picks the kind of card and the exact cue for a word due now. */
Session.prototype.chooseCue = function(entry, w, force){
  const cues = cuesFor(entry, w);
  const usable = c => (w.cueMiss[c.id] || 0) < T.CUE_RETIRE_MISSES;
  const fresh = c => !(w.cueLog[c.id] >= 0) || (w.reps - w.cueLog[c.id]) >= T.CUE_GAP;
  const lru = list => list.slice().sort((a, b) => (w.cueLog[a.id] ?? -1) - (w.cueLog[b.id] ?? -1))[0];
  const ofType = t => {
    let l = cues.filter(c => c.type === t && usable(c));
    if(!l.length) l = cues.filter(c => c.type === t);
    const f = l.filter(fresh);
    return f.length ? f : l;
  };
  if(force){
    const l = ofType(force); if(l.length) return lru(l);
  }
  const stage = clamp(w.stage, 1, 5);
  const wts = Object.assign({}, WEIGHTS[stage]);
  if(stage <= 2 && w.streak > 0) wts.ru = (wts.ru || 0) * 0.5;
  const contrastOk = stage >= STAGE.USE && this.neighbours(entry.word).some(o => (this.S.words[o] || {}).stage >= STAGE.RECALL)
    && cues.some(c => c.type === 'upgrade');
  if(!contrastOk) delete wts.contrast;
  // at the interval cap a review can't be made later, so it is made harder
  if(w.ivl >= T.MAX_IVL_DAYS && wts.probe) wts.probe += 1;
  // the gate to the last stage is two fluent probes
  if(stage === STAGE.OWN && w.probeOk < 2 && w.streak >= 1) return lru(ofType('probe')) || null;
  const opts = Object.keys(wts).filter(t => t === 'contrast' || ofType(t).length)
    .map(t => ({v: t, w: wts[t] * (t === w.lastType ? 0.25 : 1)}));
  const t = pickWeighted(opts, this.rnd) || 'intent';
  if(t === 'contrast'){
    const u = lru(ofType('upgrade'));
    return {id: 'x' + u.id, type: 'contrast', text: gapPlain(u.answer), answer: u.answer};
  }
  return lru(ofType(t)) || lru(cues);
};

/* Turns a queue item into a card the UI can render. */
Session.prototype.makeCard = function(item){
  const e = this.byWord[item.word];
  if(item.kind === 'checkin'){
    return {kind:'checkin', word: item.word, entry: e, instruction: 'Quick check',
      prompt: `Yesterday's word was “${item.word}”. Did it come out anywhere, said or written?`};
  }
  if(item.kind === 'speak') return this.makeSpeak();
  if(item.kind === 'carry') return this.makeCarry();

  const w = this.ws(e.word);
  if(item.kind === 'intro' || item.kind === 'reintro'){
    const cue = (e.intents && e.intents[0]) || e.def;
    let anchor = e.ex;
    if(item.kind === 'reintro') anchor = (e.contexts || []).find(s => s !== e.ex) || e.ex;
    return {kind:'intro', word: e.word, entry: e, cue, anchor, reintro: item.kind === 'reintro',
      instruction: item.kind === 'reintro'
        ? 'Fresh start. Guess out loud.'
        : 'New word. Guess out loud.'};
  }
  if(item.kind === 'meet'){
    return {kind:'intro', word: e.word, entry: e, cue: null, anchor: e.ex, meetOnly: true,
      instruction: 'Meet it again.'};
  }

  if(w.lapses >= T.REINTRO_LAPSES && !w.reintroDone && item.kind === 'review'){
    w.reintroDone = true;
    return this.makeCard({kind:'reintro', word: e.word});
  }
  if(w.lapses >= T.HOOK_LAPSES && !w.hookShown && e.hook && item.kind === 'review'){
    return {kind:'hook', word: e.word, entry: e, hook: e.hook,
      instruction: 'Picture this.'};
  }
  if(item.kind === 'review' && w.stage >= STAGE.RECALL && !w.personal && (e.personal || []).length
     && (this.asked || 0) < T.ASKS_PER_SESSION){
    this.asked = (this.asked || 0) + 1;
    const qs = e.personal;
    return {kind:'personal-ask', word: e.word, entry: e, question: qs[qs.length > 1 ? 1 : 0],
      instruction: 'Make it yours.'};
  }

  // a retrieval card
  let cue;
  if(item.kind === 'probe') cue = cuesFor(e, w).find(c => c.type === 'probe' && !c.cloze) || cuesFor(e, w).find(c => c.type === 'intent');
  else if(item.kind === 'learn') cue = this.chooseCue(e, Object.assign({}, w, {stage: 1}), item.step === 0 && e.ru_cue ? 'ru' : 'intent');
  else cue = this.chooseCue(e, w, item.forceType);
  if(!cue) cue = {id: 'def', type: 'intent', text: e.def};

  const stageForHints = item.kind === 'learn' ? 1 : w.stage;
  const card = {kind:'recall', type: cue.type, cueId: cue.id, word: e.word, entry: e,
    stage: w.stage, cue: cue.text, answerSentence: cue.answer || null, mine: cue.mine || null,
    pos: e.pos_full || e.pos, hints: hintSteps(e, stageForHints, cue.type === 'ru'),
    itemKind: item.kind};

  if(cue.type === 'contrast'){
    const others = shuffle(this.neighbours(e.word).filter(o => (this.S.words[o] || {}).stage >= STAGE.RECALL), this.rnd).slice(0, 2);
    card.options = shuffle([e.word].concat(others), this.rnd);
    card.hints = [];
  }
  card.instruction = {
    intent: 'Say the word.',
    probe: 'Say the word.',
    ru: 'Say it in English.',
    cloze: 'Fill the gap.',
    upgrade: 'One stronger word.',
    colloc: 'Fill the gap.',
    contrast: 'Which one?',
    personal: 'Your words. Say it.'
  }[cue.type] || 'Say the word.';

  // typed, and marked automatically: every few retrievals, always for probes
  // from stage 4, and until a word has one typed success at stage 2
  const typable = !['ru', 'contrast'].includes(cue.type) && item.kind !== 'learn';
  if(typable && w.stage >= STAGE.RECALL){
    const every = this.typedEvery();
    if(item.kind === 'probe' || (cue.type === 'probe' && w.stage >= STAGE.OWN)
       || (w.stage === STAGE.RECALL && !w.typedOk && w.streak >= 1)
       || w.reps % every === every - 1
       || (w.ivl >= T.MAX_IVL_DAYS && this.rnd() < 0.35)){
      card.typed = true;
      card.instruction = 'Type it.';
    }
  }
  if(item.kind === 'probe'){ card.typed = false; card.instruction = 'Say the word.'; card.placement = true; }
  return card;
};

Session.prototype.makeSpeak = function(){
  const S = this.S, sp = this.global.speak || [];
  const ready = this.deck.filter(e => (S.words[e.word] || {}).stage >= STAGE.RECALL);
  const count = {};
  ready.forEach(e => (e.themes || []).forEach(t => { count[t] = (count[t] || 0) + 1; }));
  const themes = Object.keys(count).sort((a, b) => count[b] - count[a]);
  const theme = themes.find(t => sp.some(p => p.theme === t)) || (sp[0] && sp[0].theme);
  S.history.speak = S.history.speak || {};
  const prompts = sp.filter(p => p.theme === theme).sort((a, b) => (S.history.speak[a.id] || 0) - (S.history.speak[b.id] || 0));
  const prompt = prompts[0] || sp[0];
  if(!prompt) return null;
  const weak = (a, b) => (S.words[a.word].ivl - S.words[b.word].ivl);
  const inTheme = ready.filter(e => (e.themes || []).includes(theme)).sort(weak);
  const rest = ready.filter(e => !inTheme.includes(e)).sort(weak);
  const words = inTheme.concat(rest).slice(0, 3).map(e => e.word);
  return {kind:'speak', prompt: prompt.prompt, promptId: prompt.id, words, seconds: 45,
    instruction: 'Talk for 45 seconds. Use all three.'};
};

Session.prototype.makeCarry = function(){
  const S = this.S, today = this.today();
  const ready = this.deck.filter(e => {
    const w = S.words[e.word];
    return w && w.stage >= STAGE.USE && (today - w.lastCarryDay) >= T.CARRY_GAP_DAYS && (e.plain || []).length;
  });
  if(!ready.length) return null;
  ready.sort((a, b) => (S.words[a.word].used - S.words[b.word].used) || (S.words[a.word].ivl - S.words[b.word].ivl));
  const e = ready[0];
  // a plain phrase only this word replaces ("boring" belongs to two words, so it
  // would be a muddy trigger); failing that, the first one
  if(!this.plainCount){
    this.plainCount = {};
    this.deck.forEach(d => (d.plain || []).forEach(p => { const k = p.toLowerCase(); this.plainCount[k] = (this.plainCount[k] || 0) + 1; }));
  }
  const plain = e.plain.find(p => this.plainCount[p.toLowerCase()] === 1) || e.plain[0];
  return {kind:'carry', word: e.word, entry: e, instruction: 'Use this today.',
    plan: `When you're about to say “${plain}”, say “${e.word}” instead.`};
};

/* ---------------------------------------------------------- speed & grade */
Session.prototype.latStats = function(type){
  const a = (this.S.lat[type] || []).filter(Number.isFinite);
  return a.length >= 6 ? {p20: percentile(a, .2), p40: percentile(a, .4), p50: percentile(a, .5), p80: percentile(a, .8)} : null;
};
/* When the automatic hints appear, measured against the learner's own speed
   on this kind of card. */
Session.prototype.hintTimes = function(card){
  const st = this.latStats(card.type);
  const med = st ? st.p50 : 3000 + 40 * String(card.cue || '').length;
  return [Math.max(5000, med * 1.5), Math.max(9000, med * 2.5), Math.max(13000, med * 3.5)].slice(0, card.hints.length);
};
/* 0 missed, 1 hard, 2 effortful, 3 fluent, 4 instant. */
Session.prototype.grade = function(card, res){
  if(!res.ok) return 0;
  if(res.close || res.hints >= 2) return 1;
  let g = 3;
  if(!res.noSpeed && Number.isFinite(res.latency)){
    const st = this.latStats(card.type);
    const base = 3000 + 40 * String(card.cue || '').length;
    const p20 = st ? st.p20 : base * 0.6, p40 = st ? st.p40 : base, p80 = st ? st.p80 : base * 2.2;
    g = res.latency <= p20 ? 4 : res.latency <= p40 ? 3 : res.latency <= p80 ? 3 : 2;
  }
  if(res.hints === 1) g = Math.min(g, 2);
  return g;
};

Session.prototype.schedule = function(word, g, info){
  info = info || {};
  const w = this.ws(word), today = this.today();
  w.reps++;
  w.lastDay = today;
  if(g === 0){
    w.lapses++;
    w.consecMiss++;
    w.ease = clamp(w.ease - 0.2, T.EASE_MIN, T.EASE_MAX);
    w.ivl = 1;
    w.due = today + 1;
    w.streak = 0;
    // a miss on a sentence-level card means that skill needs work, not that the
    // word is gone: only a miss on a plain cue (or two in a row) drops a stage
    if(CORE_TYPES.includes(info.type) || w.consecMiss >= 2) w.stage = Math.max(STAGE.MEET, w.stage - 1);
    return;
  }
  w.consecMiss = 0;
  w.ease = clamp(w.ease + [0, -0.15, -0.05, 0.02, 0.1][g], T.EASE_MIN, T.EASE_MAX);
  let ivl;
  if(w.ivl < 1) ivl = g >= 3 ? 2 : 1;
  else ivl = w.ivl * (g === 1 ? 1.2 : w.ease) * ({1: 1, 2: 0.8, 3: 1, 4: 1.25}[g]);
  ivl = Math.round(ivl);
  if(g >= 2) ivl = Math.max(ivl, w.ivl + 1);
  w.ivl = clamp(ivl, 1, T.MAX_IVL_DAYS);
  w.due = today + w.ivl;

  if(info.typed && g >= 1 && w.stage === STAGE.RECALL) w.typedOk = true;
  if(info.type === 'probe' && g >= 3) w.probeOk++;
  const slow = Number.isFinite(info.latency) && info.latency > T.SLOW_NO_PROMOTE_MS;
  if(g >= 2 && !slow && w.lastOkDay !== today){
    w.streak++;
    w.lastOkDay = today;
    let up = false;
    if(w.stage === STAGE.MEET) up = w.streak >= 1;
    else if(w.stage === STAGE.RECALL) up = w.streak >= 2 && w.typedOk;
    else if(w.stage === STAGE.USE) up = w.streak >= 2;
    else if(w.stage === STAGE.OWN) up = w.probeOk >= 2;
    if(up){ w.stage++; w.streak = 0; }
  }
};

/* ------------------------------------------------------------ public flow */
Session.prototype.next = function(){
  for(let guard = 0; guard < 500; guard++){
    if(!this.queue.length) this.addTail();
    const item = this.queue.shift();
    if(!item) return null;
    const card = this.makeCard(item);
    if(card){ this.current = {item, card}; return card; }
  }
  return null;
};

Session.prototype.noteLatency = function(card, res){
  if(!res.ok || res.noSpeed || card.typed || !Number.isFinite(res.latency) || res.latency > T.LAT_DISCARD_MS) return;
  const a = this.S.lat[card.type] = this.S.lat[card.type] || [];
  a.push(Math.round(res.latency)); if(a.length > 40) a.shift();
};
Session.prototype.noteCalibration = function(card, res){
  if(card.stage < STAGE.RECALL || card.options) return;
  const a = card.typed ? this.S.cal.typed : this.S.cal.self;
  a.push(res.ok && !res.close ? 1 : 0); if(a.length > 40) a.shift();
};

/* The one call the UI makes after each card. */
Session.prototype.answer = function(res){
  const cur = this.current; if(!cur) return;
  const {item, card} = cur;
  const S = this.S, today = this.today();
  res = res || {};
  this.current = null;

  if(card.kind === 'checkin'){
    if(res.yes) this.credit(card.word);
    S.day.checkin = null;
    return;
  }
  if(card.kind === 'speak'){
    S.day.speakDone = true;
    S.history.speak = S.history.speak || {};
    S.history.speak[card.promptId] = this.now();
    (res.used || []).forEach(wd => this.credit(wd));
    return;
  }
  if(card.kind === 'carry'){
    S.day.carry = {word: card.word, n: today};
    this.ws(card.word).lastCarryDay = today;
    return;
  }

  const w = this.ws(card.word);
  if(card.kind === 'intro'){
    if(card.meetOnly){
      this.queueLearn(card.word);
      return;
    }
    if(!card.reintro) S.day.newCount = (S.day.newCount || 0) + 1;
    w.stage = STAGE.MEET; w.introDay = today; w.due = today + 1; w.ivl = 0; w.streak = 0;
    w.lastDay = today; w.placement = false;
    w.cueLog.i0 = w.reps;            // the guess cue was just seen: practise from the others first
    if(card.reintro){ w.cueMiss = {}; w.consecMiss = 0; }
    this.queueLearn(card.word);
    this.done++;
    return;
  }
  if(card.kind === 'hook'){
    w.hookShown = true;
    this.insertAt(2, {kind:'review', word: card.word, forceType: 'intent', afterHook: true});
    return;
  }
  if(card.kind === 'personal-ask'){
    const a = (res.text || '').trim().slice(0, 200);
    w.personal = {q: card.question, a, day: today, skipped: !a};
    // the review that was due still happens
    this.insertAt(0, {kind:'review', word: card.word});
    return;
  }

  // a retrieval
  this.noteLatency(card, res);
  this.noteCalibration(card, res);
  const g = this.grade(card, res);
  w.lastType = card.type;
  if(card.cueId){ w.cueLog[card.cueId] = w.reps; if(g === 0) w.cueMiss[card.cueId] = (w.cueMiss[card.cueId] || 0) + 1; }
  this.done++;

  if(item.kind === 'probe'){
    S.day.probeCount = (S.day.probeCount || 0) + 1;
    w.placement = false;
    if(g === 0){
      // not a lapse: it just shows recognition didn't carry over to producing it
      w.cueLog = {}; w.cueMiss = {};
      w.stage = STAGE.MEET; w.introDay = today; w.ivl = 0; w.due = today + 1; w.lastDay = today;
      this.insertAt(0, {kind:'meet', word: card.word});
    } else {
      w.stage = (g >= 3 && w.oldIvlDays >= T.MAX_IVL_DAYS) ? STAGE.USE : STAGE.RECALL;
      w.introDay = today - T.FAMILY_HOLD_MAX;
      w.ivl = g >= 3 ? clamp(Math.round(w.oldIvlDays / 2), 2, T.MAX_IVL_DAYS) : 2;
      w.due = today + w.ivl; w.lastDay = today; w.reps++;
    }
    return g;
  }
  if(item.kind === 'learn'){
    // practice of a word met today: no schedule change. Three successes, at
    // most five tries, and the third is skipped if the second was fluent.
    const L = this.learn[card.word] = this.learn[card.word] || {succ: 0, attempts: 0};
    L.attempts++;
    if(g > 0) L.succ++;
    const enough = L.succ >= 3 || (L.succ >= 2 && g >= 3) || L.attempts >= T.LEARN_MAX_ATTEMPTS;
    if(!enough){
      const gap = g === 0 ? T.MISS_REQUEUE : T.LEARN_GAPS[Math.min(L.succ, T.LEARN_GAPS.length - 1)];
      this.insertAt(gap, {kind:'learn', word: card.word, step: L.succ});
    }
    return g;
  }
  if(item.kind === 'relearn'){
    if(g === 0) this.insertAt(T.MISS_REQUEUE, {kind:'relearn', word: card.word, forceType: card.type === 'contrast' ? 'upgrade' : card.type});
    return g;
  }
  this.schedule(card.word, g, {type: card.type, typed: card.typed, latency: res.noSpeed ? NaN : res.latency});
  if(g === 0){
    // straight back in this session after a few cards; a sentence-level miss
    // gets the same kind of card again, a plain miss gets a plain cue
    const t = CORE_TYPES.includes(card.type) ? 'intent' : (card.type === 'contrast' ? 'upgrade' : card.type);
    this.insertAt(T.MISS_REQUEUE, {kind:'relearn', word: card.word, forceType: t});
  }
  return g;
};

Session.prototype.queueLearn = function(word){
  this.learn[word] = {succ: 0, attempts: 0};
  this.insertAt(T.LEARN_GAPS[0], {kind:'learn', word, step: 0});
};

/* Real-life use and Speak ticks count as a successful review and restart the
   clock: the strongest sign there is that the word is needed. */
Session.prototype.credit = function(word){
  const w = this.ws(word), today = this.today();
  w.used++; w.lastUsedDay = today;
  if(w.stage >= STAGE.RECALL && w.lastDay !== today) this.schedule(word, 3, {type: 'use'});
};

Session.prototype.summary = function(){
  const S = this.S, today = this.today();
  let due = 0, tomorrow = 0, placement = 0;
  const byStage = [0,0,0,0,0,0];
  this.deck.forEach(e => {
    const w = S.words[e.word];
    if(w && w.placement) placement++;
    byStage[w ? w.stage : 0]++;
    if(w && w.stage >= 1 && w.due <= today) due++;
    if(w && w.stage >= 1 && w.due === today + 1) tomorrow++;
  });
  return {due, tomorrow, byStage, placement, newToday: S.day.newCount || 0};
};

const api = {T, STAGE, STAGE_NAMES, dayNum, emptyState, repair, importOld, Session, checkTyped, hintSteps, hideWord, norm, cuesFor, gapWithLetter};
if(typeof module !== 'undefined' && module.exports) module.exports = api;
else root.VocabEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
