# Vocab

A single-user flashcard app for IELTS high-band vocabulary. Built for iPhone, dark mode, works offline once loaded.

**Live:** https://futurenyx.github.io/vocab-flashcards/

Add it to your home screen (Share > Add to Home Screen) and it opens full-screen like a native app.

## How it works

- **Front:** the example sentence first and largest, with the word highlighted, and the word itself underneath with its part of speech written out in full. Context before label: the point is to meet the word in use and only then name it. Sentences use everyday vocabulary so the meaning is inferable without the back of the card.
- **Tap the card** to flip.
- **Back:** the word again, then one block per language. English gives Definition and Synonyms; Russian gives Значение and Синонимы, labelled in Russian because the reader is a native speaker. Synonyms are chips with light text on green.
- **Speaker button**, bottom right, reads the word aloud. It sits outside the flipping card rather than on a face: Safari's hit testing inside a `preserve-3d` subtree routed taps to the card underneath, so the old button flipped the card instead of speaking. One button serves both sides.
- **Wrong / Hard / Easy** at the bottom, each showing when the card comes back.
- **Home screen** wears the app icon's colours, bright green with black lettering. Only that screen: the cards and the study screen keep the dark ground, and the iPhone status bar colour is swapped to match whichever screen is showing.

## The voice

**Every headword ships as an MP3.** The phone's own speech engine is not used unless a clip is missing. That is deliberate: iOS defaults to a compact voice that sounds robotic, and the only way to improve it on the device is to go into Settings and download a better one. Bundling the audio means it sounds the same on every phone, needs no setup, and works offline.

The clips are rendered by [Piper](https://github.com/rhasspy/piper) with the British female voice **Jenny (Dioco)**, 121 files, about 650 KB in total. To rebuild them, install Piper and a voice model and run:

```
powershell -File make-audio.ps1 -Piper <path>\piper.exe -Model <path>\en_GB-jenny_dioco-medium.onnx
```

It only renders clips that are missing, writes `audio-manifest.json` for the service worker, and lists any orphans left behind by a deleted word. Pass `-Force` after changing voice. Filenames are slugs of the word, so `words.csv` stays the source of truth. Alternative voice that is public domain: `en_GB-cori-medium` (LibriVox). Note `en_GB-cori-high` will not load in the 2023.11 Piper build.

The fallback path still scores the device's own voices, and reads the quality tier from `voiceURI` rather than `name`: on iOS the default `com.apple.voice.compact.en-GB.Daniel` and the good `...voice.enhanced.en-GB.Serena` differ only in the URI, so scoring on the name alone lets the robotic one win.

## Installing it on the phone

Open the site in Safari, Share, Add to Home Screen. `manifest.json` and `sw.js` make it behave like an app once installed:

- it launches full screen with the green **V** icon rather than a black screenshot,
- `sw.js` caches the page, the words and the fonts, so it opens with no signal (the app itself is network-first, so a new version still arrives as soon as there is a connection; fonts and icons are cache-first),
- `navigator.storage.persist()` asks Safari not to evict the progress, which it otherwise may do for a site left unused for weeks.

To change the icon, edit `icon-src.html` and run `powershell -File make-icons.ps1`, which rasterises it to the three PNG sizes iOS and Android ask for.

## Progress, and not losing it

Progress is keyed by the word itself, never by its position in the deck, so words can be added, reordered or deleted and every remaining card keeps its schedule. **Do not ever change `KEY` in `index.html`** (`vocab.main.v2`): that single string is the difference between shipping an update and wiping someone's reviews. `load()` repairs whatever it finds rather than discarding it, and leaves unknown fields alone so an older build cannot destroy data written by a newer one.

Due dates are absolute epoch milliseconds, which is the phone's own clock: a VPN, a flight or a timezone change cannot move them. The one thing that would is the device clock jumping backwards, which would push every card into the future and leave nothing to review, so the app records when it last ran and slides all due dates by the same amount if it finds time has gone backwards by more than five minutes.

## The scheduling

Deliberately short-term. A word you keep getting right tops out at 10 days rather than disappearing for a month.

| | New word | Learning | Mature card |
|---|---|---|---|
| Wrong | 1 min | 1 min | 5 min, then interval cut to 40% |
| Hard | 10 min | 1 day | interval x 1.3 |
| Easy | 2 days | 2 days | interval x ease (starts 2.2) |

Ceiling is 10 days. A typical Easy run goes 2d, 4d, 10d and then holds there.

## Requesting a word

The **+** button opens a request box. Type a word, press Send, and it POSTs to `/word-request` on the `claude-buffer` Cloudflare Worker, which pings Elijah on Telegram and stores the request in KV.

Statuses in that sheet are derived, not pushed back:

- **not sent yet** (yellow) queued on the phone, no network yet. Retried every time the sheet opens.
- **pending** (yellow) delivered to the worker, not yet in the deck.
- **✓ added** (green) the word now exists in `words.csv`, so publishing it *is* the reply. No status API needed.

That endpoint is deliberately not behind `BUFFER_TOKEN`: this is a public page, and shipping the token would expose the whole Telegram buffer to any visitor. Instead it is write-only, capped at 60 characters, and rate limited to 10 per IP per hour and 100 a day.

To collect the requests, ask Claude in chat: it reads `GET /<BUFFER_TOKEN>/word-requests` and appends them to `requests.csv`.

## Type

Fraunces (display serif) sets the word itself, the app title and the section headings; Manrope sets everything else and carries the Cyrillic. Both are self-hosted from `fonts/` as variable woff2, about 107 KB in total, so the app makes no third-party request from the phone and still renders correctly offline.

Fraunces has an optical-size axis, and each place that uses it sets its own `font-variation-settings:'opsz'`: 144 on the hero word, 72 on the back, 60 on the stat numbers. That is why the big word reads as display type rather than as a small letterform blown up. Its `unicode-range` is Latin only, so any Cyrillic falls through to Manrope automatically.

## Changing the colours

Five palettes are defined at the top of `index.html`. Switch by editing one attribute on the `<html>` tag:

```html
<html lang="en" data-palette="linen">
```

- `grove` (current) warm forest-floor dark, oat text, leaf-green accent
- `linen` the daylight version: beige paper, deep green ink
- `fern` cool near-black green, fresh mint accent
- `moss` deep forest base, sage green accent
- `clay` warm brown earth base, soft olive accent

Every colour in the app comes from those variables, so nothing else needs touching. If you change palette, also update the `theme-color` meta tag to match the new `--bg` so the iPhone status bar blends in. Switching to `linen` additionally wants `color-scheme` set to `light`.

## Editing the word list

`words.csv` is the source of truth. Columns:

```
word, part_of_speech, definition, russian_definition, english_synonyms, russian_synonyms, example
```

In `example`, wrap the target word in asterisks (`*exacerbate*`) and that span gets highlighted, whatever form the word takes in the sentence.

Sentences are the first thing the learner reads, so keep them in plain everyday English: no rare words other than the target, and enough context that the meaning is guessable. `examples.json` holds them keyed by word, which is the easy way to rewrite a batch of them; applying it back to the CSV is a few lines of PowerShell.

121 cards: 97 single words and 24 idioms (`idioms.json` holds the idioms as first written). **File order is running order**, because new cards are introduced top to bottom, so the idioms are interleaved through the CSV rather than appended, roughly one every four words. If you add more, spread them the same way. Idioms belong in Speaking rather than Writing Task 2, which wants a formal register.

After adding a word, run `make-audio.ps1` as well as `build.ps1`, or that card falls back to the phone's robotic voice.

After editing the CSV, regenerate the data file:

```bash
powershell -File build.ps1
```

That writes `words.js`, which is what the app actually loads. Commit both.

## Notes

- Progress lives in the browser's localStorage, so it is per-device and survives closing the app. Clearing Safari website data wipes it.
- Russian text follows the house rule of no letter "e with diaeresis": always plain "е".
