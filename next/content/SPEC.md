# Content spec for Vocab v3 (per word)

Learner: adult Russian speaker, advanced English, preparing for IELTS. Goal: the English word
springs to mind when its meaning comes up. Read `next/DESIGN.md` for why each field exists.

Source of each word's existing data: `words.csv` (word, part_of_speech, definition,
russian_definition, english_synonyms, russian_synonyms, example) and `contexts.js` (10 sentences
per word with the word in *asterisks*). Keep consistent with them.

Output: one JSON file, an array of objects in deck order, UTF-8, no BOM. Exactly these keys:

```json
{
  "word": "exacerbate",
  "intents": [
    "make a bad situation even worse",
    "add fuel to a problem that already exists",
    "turn a small difficulty into a bigger one by what you do"
  ],
  "ru_cue": "сделать и без того плохую ситуацию еще хуже",
  "plain": ["make worse", "worsen"],
  "upgrades": [
    {"plain": "Shouting at him will only [make the situation worse].",
     "better": "Shouting at him will only *exacerbate* the situation."},
    {"plain": "...", "better": "..."},
    {"plain": "...", "better": "..."}
  ],
  "collocations": [
    {"chunk": "exacerbate the problem", "frame": "___ the problem"},
    {"chunk": "greatly exacerbate", "frame": "greatly ___"}
  ],
  "ru_trap": "",
  "nuance": "Only for something already bad: you can't exacerbate a good mood.",
  "personal": [
    "What tends to exacerbate your stress before an exam?",
    "Who do you know whose 'help' usually exacerbates a problem?"
  ],
  "gesture": "",
  "hook": "Sounds like 'eggs are bait': throwing eggs at a bear only makes it angrier.",
  "forms": ["exacerbate", "exacerbates", "exacerbated", "exacerbating"]
}
```

## Field rules

**intents** (3-4). What the speaker *wants to say*, in plain everyday English, written as the
thought before the word, lowercase, no full stop. These are the main cue cards: the learner reads
one and must produce the word.
- Never contain the word, any form of it, or an obvious give-away root.
- **Diagnostic**: an advanced learner who knows the whole deck should land on THIS word and not
  a neighbour. Check against the deck's near-neighbours (e.g. mitigate / alleviate, ubiquitous /
  prevalent, undermine / underpin, disparity / discrepancy, tedious / mundane). Build each intent
  around what makes the word different. If two deck words genuinely overlap, the intent must
  include the distinguishing feature (alleviate = pain, suffering, symptoms; mitigate = reducing
  the harm or risk of something).
- Vary the angle: one definition-like, one situational ("when your phone dies and you have no
  charger and no map..."), one about the feeling or effect.
- No rare words in the intent itself.

**ru_cue** (1). The same meaning as a short Russian phrase, a cue for the earliest stage. Natural
Russian. **Never use the letter "ё"; always write "е".** Should not simply be one of the
russian_synonyms (describe the meaning).

**plain** (1-3). The ordinary words or phrases a learner would say instead (the default this word
must beat). For idioms, the literal plain phrasing.

**upgrades** (3). Everyday sentences someone would actually say, where the plain phrase (in
[square brackets]) is replaced by the deck word in `better`, with the word in *asterisks* exactly
once. The `better` sentence must be natural and grammatical, possibly with small adjustments
around the word. Give some emotional stakes (embarrassment, a deadline, a family argument,
a small triumph) in at least one of the three. Plain English otherwise.

**collocations** (2-3). The word's most frequent, most useful partners (think corpus frequency,
IELTS writing and speaking). `frame` replaces the target word with `___`. Must be specific
enough that the gap points to this word (a frame like "the ___" is useless). For idioms, give the
typical surrounding phrase ("it was ___", "came completely ___"), or leave [] if nothing natural.

**ru_trap**. Only when a Russian speaker is likely to get the collocation or usage wrong because
Russian works differently (wrong preposition, wrong verb partner, false friend, register). One
short English line, e.g. "Russian 'принять решение' tempts 'take a decision'; English says
*make* a decision." Empty string otherwise. Do not force it.

**nuance** (1). One line that separates this word from its nearest neighbour or the plain word:
when to use it, connotation, register, what it can't describe.

**personal** (2). Questions that make the learner tie the word to their own life. One about
themselves or a memory, one about **a person they know** (family, friend, colleague, teacher).
Answerable in a line. Use the word in the question (they are shown after the word is known).

**gesture**. A short instruction for a body movement that acts out the meaning, ONLY if the word
genuinely suits it (physical, manner, movement, or a strong visual metaphor). Aim for roughly one
word in four. Empty string otherwise.

**hook**. A sound-alike memory image linking the word's sound to its meaning, used only if the
learner keeps forgetting the word. May use an English or a Russian sound-alike (the learner is
Russian), e.g. "*daunting* — 'донт' (don't): the mountain says 'don't even try'". Vivid and
short. No "ё".

**forms**. Every inflected form a correct typed answer could take (verbs: base, -s, -ed, -ing,
irregulars; nouns: plural; adjectives: just the base plus comparatives only if used). Lowercase.
British spelling first, include the American variant as well where it differs (prioritise /
prioritize). For idioms: the base phrase plus natural variants (e.g. "hits the nail on the head",
"hit the nail on the head").

## General
- British English (the deck uses -ise).
- No names of real public figures, brands, politics, religion.
- Plain words around the target. The target is the only hard word anywhere.
- Validate your file parses as JSON before finishing.
