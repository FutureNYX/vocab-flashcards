# Vocab v3: design

Goal (Elijah, 10 Oct 2026): learning as fast and as effective as possible, and as easy as
possible for the user. They press one button and the app does the rest. Cards may be hard,
but it is always obvious what to do. UI polish comes later; this stage is about how it works.

The goal of the learning itself: a word **springs to mind** when its concept or a fitting
situation comes up, i.e. productive, cued-by-meaning retrieval that beats the plain default
word. Research behind this: https://claude.ai/artifact/2XPcdzrEQzx6Lx2QrLWwYc

## Requirements, weighted by evidence

Weight 3 = strong (meta-analytic / replicated), 2 = moderate, 1 = early. "Z" = the zero-decision
constraint, which outranks everything.

| # | Requirement | Weight |
|---|---|---|
| Z | One button; the app picks every card; each card states its one action | Z |
| R1 | Main drill is meaning/situation → produce the word (direction specificity) | 3 |
| R2 | Retrieval, spaced, with the full answer straight after a miss | 3 |
| R3 | Several successful retrievals of a new word in its first session | 3 |
| R4 | Collocations / chunks, with Russian-mismatch traps called out | 3 |
| R5 | Cues are diagnostic: each points to one word only | 3 |
| R6 | Say it aloud (production effect), not on every card | 3 |
| R7 | Consistent mapping (same intention → same word) for automaticity | 3 |
| R8 | Beat the plain default word explicitly (upgrade practice, if-then plans) | 2-3 |
| R9 | Own output: sentence, then extended speech, once the form is stable | 2-3 |
| R10 | Anchor first, then a new context at every review | 2 |
| R11 | Keep synonyms, opposites and look-alikes apart at introduction; contrast later | 2 |
| R12 | Self-reference and people the learner knows | 2 |
| R13 | Russian as the first bridge, faded out as the word matures | 2 |
| R14 | Sleep before the first real test (introduce, test next day) | 2 |
| R15 | Retrieval speed as the sign of automaticity | 2 |
| R16 | Real-world use logged; it is the strongest "needed" signal | 2 |
| R17 | Guess first, then reveal (errorful generation, curiosity) | 2 |
| R18 | Thematic grouping of new words (situations, IELTS topics) | 2 |
| R19 | Pictures fix the concept but never replace retrieval (shown after the attempt) | 2 |
| R20 | Gesture for words that suit it (a minority, for distinctiveness) | 2 |
| R21 | Keyword mnemonic only for leeches | 2 |
| R22 | Typed recall sometimes (spelling for IELTS writing; objective check) | 2 |
| R23 | Interleave only confusable words; block otherwise | 2 |
| R24 | Emotional stakes in example situations | 2 |
| R25 | Ambient prompts through the day | 1 |
| R26 | Conversation with a partner who seeds the word | 2 (but costs money) |

## Five approaches

**A. Production flashcards.** Today's SRS deck with new card types added (situation→word,
upgrade, collocation gap, personal). The user still sees one card per word, but of several kinds.
Strong on R1, R2, R3, R7. Nothing moves a word from "known" to "used": no real output, no
real-life layer, no sense of stages, so every card type is mixed at random regardless of how
well the word is known.

**B. Word ladder.** Each word climbs stages that mirror the research hierarchy of knowledge:
*meet → recall → use → own → free*. A spaced scheduler decides *when* a word comes back; its stage
decides *what kind* of card it gets. Early on it gets cheap, frequent retrievals with the Russian
bridge (R3, R13); then varied English situation cues (R1, R10); then upgrades, collocations and
contrast (R4, R8, R11); then the learner's own life (R12); then free speech and real use (R9, R16).
Covers nearly everything, and its structure is exactly what lets the app make every decision.

**C. Scene sessions.** The mind palace reborn: each session is a scene (a flood, a job interview)
holding 6-8 words that you explore and then narrate. Excellent for R18, distinctiveness and
thematic memory. Weak on per-word spacing (a whole scene comes back at once, so strong and weak
words get the same schedule) and on cue variety: words risk becoming tied to their scene, which
is the context dependence we want to avoid. Heavy on illustration.

**D. Life engine.** The app is driven by real situations and missions: "today, use *exacerbate*",
if-then plans, situation prompts through the day, a used-it log. Best on transfer (R8, R16).
Weak at the start: a word you met once cannot yet be used in life, and there is no efficient
drilling to get it there.

**E. Conversation tutor.** An AI partner seeds your words and asks questions where they fit.
The most realistic output (R9, R26). Costs money per use, needs signal, can't guarantee each word
gets enough spaced retrievals, and its grading is unreliable. Not a foundation.

## Scoring

Each approach scored 0-2 per requirement (0 = absent, 1 = partial, 2 = full), multiplied by weight.

| | A | B | C | D | E |
|---|---|---|---|---|---|
| Z zero-decision | 2 | 2 | 1 | 1 | 1 |
| R1 meaning → word (3) | 6 | 6 | 3 | 3 | 3 |
| R2 spaced + feedback (3) | 6 | 6 | 3 | 0 | 0 |
| R3 day-one retrievals (3) | 6 | 6 | 3 | 0 | 0 |
| R4 collocations (3) | 3 | 6 | 3 | 3 | 3 |
| R5 diagnostic cues (3) | 3 | 6 | 3 | 3 | 0 |
| R6 aloud (3) | 3 | 6 | 6 | 3 | 6 |
| R7 consistent mapping (3) | 6 | 6 | 3 | 3 | 0 |
| R8 beat the default (2.5) | 2.5 | 5 | 0 | 5 | 2.5 |
| R9 own output (2.5) | 0 | 5 | 5 | 2.5 | 5 |
| R10 anchor then vary (2) | 2 | 4 | 0 | 2 | 2 |
| R11 separate confusables (2) | 2 | 4 | 4 | 0 | 0 |
| R12 self and people (2) | 2 | 4 | 0 | 4 | 2 |
| R13 Russian fade (2) | 0 | 4 | 0 | 0 | 0 |
| R14 sleep first (2) | 2 | 4 | 2 | 0 | 0 |
| R15 speed (2) | 2 | 4 | 0 | 0 | 0 |
| R16 real use (2) | 0 | 4 | 0 | 4 | 2 |
| R17 guess first (2) | 2 | 4 | 2 | 0 | 2 |
| R18 themes (2) | 0 | 2 | 4 | 2 | 2 |
| R19-R24 (2 each, summed) | 6 | 12 | 8 | 2 | 2 |
| **Total (excl. Z)** | **53.5** | **102** | **49** | **36.5** | **31.5** |

B wins by a wide margin, and it is the only approach where the zero-decision constraint comes
for free: stage + schedule fully determine the next card. C and D each contribute one thing B
lacks on its own, so the design is **B as the engine**, with:
- from C: new words are introduced in **themed batches**, and the output task at the end of a
  session is a scene to describe;
- from D: a **carry word** with an if-then plan at the end of each session, and a one-tap
  "did you use it?" at the start of the next.
E is left as an optional later add-on, priced first.

## Changes after the adversarial review (built this way)

An independent review attacked the first draft. Accepted, and implemented in `engine.js`:
- **Stages weight the mix; they don't lock card types away.** Upgrades and collocations appear
  from stage 1, the personal question on reaching stage 2 (max 2 per session, it means typing),
  Speak once 3 words are at stage 2. Contrast still waits for all neighbours to be at stage 2.
- **A miss on a sentence-level card (upgrade, collocation, contrast, personal) doesn't drop the
  stage**; only a miss on a plain cue (situation, Russian, gap, probe) or two misses in a row does.
  Any miss sets the interval to 1 day.
- **Cues rotate least-recently-used across all types**; a cue doesn't repeat within 3 reviews of its
  word; a cue missed 3 times is retired. One intent and two sentences per word are **held out** and
  only used as probes: two fluent probes are the gate to stage 5.
- **Gaps show the first letter** (sentence gaps and collocation frames), the standard
  controlled-production format, so synonyms don't fit.
- **No Hint button.** Hints (first sound, then first syllable; Russian only at stage 1) appear on
  their own at 1.5x and 2.5x the learner's own median time for that card type.
- **Honest self-marking:** one fixed rule under every answer ("Got it means you said this word,
  in any form, before you tapped Show"); typed cards double as a calibration check: if self-marked
  success runs >15 points above typed success, every 2nd retrieval becomes typed. Leaving stage 2
  needs one typed success. A Got it after 20 s counts for the interval, not for promotion.
- **Speed is per card type and per learner** (percentiles of their own times), ignores time spent
  with the app in the background, and only nudges the interval (+-25%).
- **Workload:** the session budget counts new-word repeats. Due words are ordered by risk (time
  since last review / interval), not by date. New words only while due < 40 and the next 7 days
  average <= 32/day. Simulation (`node next/sim.js`): ~11 min/day while learning, the 129-word
  deck fully introduced by about day 50, 3-5 min/day once known.
- **Import = placement check.** Words reviewed in the old app wait, then get one probe each (10 a
  day, most mature first): fluent hit on a 10-day word -> stage 3, other hit -> stage 2, miss ->
  a "meet again" card and stage 1, not counted as a lapse. The old key is read only.
- **Families are direct neighbours only**; a word waits until its neighbour is 7 days old and past
  its first next-day test, never more than 10 days.
- **Leeches:** memory hook after 4 misses, full re-introduction with a different anchor after 7.
- **Real use restarts the clock:** a Speak tick or a "yes" at the check-in counts as a review for
  any word at stage 2+.

Content QA: a blind test (a reader shown only the cue and the deck list names the word) got
99.5% of situation cues, 100% of Russian cues and 98.5% of upgrades right; collocation frames
were the weak spot (86%), fixed with the first-letter gap. Ambiguous cues were rewritten.

## The chosen design (first draft; see the changes above)

### The session (one button: Start)
1. **Check-in** (only if yesterday had a carry word): "Did *exacerbate* come out anywhere?"
   Yes / Not yet. One tap.
2. **Reviews and new words**, interleaved. The app builds the queue:
   - due words, most overdue first;
   - new words if the daily allowance and the review load permit (see "new words");
   - a new word's in-session repeats are slotted between other cards.
3. **Speak** (at most once a day, only when 3+ words are at stage *use* or higher): a 45-second
   IELTS-style prompt from a theme, with 3 due words to work in. Timer, then tap the ones you used.
4. **Carry word** for today: one word at stage *use*+, with its if-then plan ("When you're about
   to say *make it worse*, say *exacerbate*"). One tap: OK.
5. Done. The app says when the next review is due.

The session has a soft length (about 25 cards); if more is due, the rest waits for the next
session. Nothing is ever a menu.

### Stages and what each one practises

| Stage | Name | Card types (the app picks; never the same type twice running for a word) |
|---|---|---|
| 0 | New | **Introduction**: guess first from a situation → reveal word, anchor sentence, clip, voice, Russian, collocation, nuance; say it aloud; gesture if it has one. Then 3 in-session retrievals at growing gaps. |
| 1 | Meet | Russian situation → word; English situation → word (hints allowed). First test is the next day. |
| 2 | Recall | English situation → word (rotating, diagnostic); gap in a new sentence (rotating contexts); typed recall every 3rd or 4th time. Russian only as a hint. |
| 3 | Use | Upgrade (plain words struck out → say the deck word); collocation gap; contrast with its confusable neighbours once all are at stage 2+; situation → word continues. |
| 4 | Own | Once: a personal prompt (yourself, a person you know, a memory); the reply becomes a cue with the word hidden. Then a mix of all the above. Eligible as a carry word. |
| 5 | Free | Long intervals; appears in Speak tasks and as carry words; a used-it or a Speak tick counts as a review. |

Promotion: two successful reviews at the stage, on different days (stage 0 → 1 after its
in-session repeats). A miss drops the word one stage, never to zero, and brings it back in
the same session after a few cards (feedback first).

### Grading without decisions
Every retrieval card: the user says (or types) the word, taps **Show**, sees the answer and taps
**Got it** or **Missed**. That is the only judgement asked of them. The app grades the rest:
- time from card shown to Show = retrieval speed; under ~4 s counts as fluent, 4-10 s as effortful,
  longer as hard (thresholds adapt to the learner's own median);
- hints used: each step down the hint ladder lowers the grade;
- typed cards are checked automatically against the word's accepted forms; no buttons at all.
The hint ladder: first sound → first syllable → Russian meaning → answer.

### Scheduling
SM-2 style ease and interval per word, on production strength, with the grade above. In-session
repeats for new and missed words. Interval cap `MAX_IVL_DAYS = 10` (Elijah's standing rule; the
research favours longer gaps for long-term memory, so this is a single constant he can change).
New words' first real test: the next morning (sleep first).

### New words
- Daily allowance: up to 6, introduced only while today's due load is under 30 cards, so the
  backlog never runs away. The user never chooses.
- Batches of 3-6 from one theme.
- A word is held back while any member of its confusable family was introduced in the last
  7 days or is below stage 2.
- Leeches (3+ misses): the word gets a memory-hook card (sound-alike image), once.

### Content each word needs (`next/content/*.json`)
`intents` (3-4 plain-English "you want to say" cues, diagnostic, never containing the word),
`ru_cue` (one Russian situation cue, no letter "yo"), `plain` (default words it replaces),
`upgrades` (3 plain sentences with the replaceable span marked, plus the upgraded sentence),
`collocations` (2-3 chunks with a gap frame; optional Russian-trap note), `nuance` (one line),
`personal` (2 prompts, one about a person), `gesture` (only where it truly fits), `hook`
(sound-alike mnemonic for leeches), `forms` (accepted inflections for typed answers).
Global: `themes` per word, confusable `families`, and Speak prompts per theme.
Existing fields stay: definition, Russian, synonyms, the 10 rotating contexts, clip, audio.

### Storage and existing progress
- New state lives under its own key `vocab.v3`. The old key `vocab.main.v2` is **read only**:
  never written, never deleted. On first run, words already reviewed in the old app are imported
  at stage 2 (recall), with their first production review spread over the next few days so nobody
  faces a wall of cards; words that were mid-learning start at stage 1.
- Personal lines live only on the device.

### Built as a preview
`next/` is a self-contained app with its own service worker scoped to `next/`, so the live app
and everyone's progress are untouched until Elijah decides to switch.

### Later (not in this stage)
UI polish, illustrated scenes, push notifications with situation cues, "upgrade my text",
recording and playback of Speak answers, an AI conversation partner (priced first).
