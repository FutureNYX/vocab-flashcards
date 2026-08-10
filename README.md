# Vocab

A single-user flashcard app for IELTS high-band vocabulary. Built for iPhone, dark mode, works offline once loaded.

**Live:** https://futurenyx.github.io/vocab-flashcards/

Add it to your home screen (Share > Add to Home Screen) and it opens full-screen like a native app.

## How it works

- **Front:** the word, its part of speech, and an example sentence with the word highlighted.
- **Tap the card** to flip.
- **Back:** the word again, then one block per language. English gives Definition and Synonyms; Russian gives Значение and Синонимы, labelled in Russian because the reader is a native speaker. Synonyms are chips, tinted the same as the highlight on the front.
- **Speaker button** reads the word aloud (top right on both faces). It defaults to a British female voice; left alone, iOS picks Daniel, which is the deep robotic one. The **Voice** picker on the home screen overrides the choice and remembers it, since voice names differ on every device.
- **Wrong / Hard / Easy** at the bottom, each showing when the card comes back.

## The scheduling

Deliberately short-term. A word you keep getting right tops out at 10 days rather than disappearing for a month.

| | New word | Learning | Mature card |
|---|---|---|---|
| Wrong | 1 min | 1 min | 5 min, then interval cut to 40% |
| Hard | 10 min | 1 day | interval x 1.3 |
| Easy | 2 days | 2 days | interval x ease (starts 2.2) |

Ceiling is 10 days. A typical Easy run goes 2d, 4d, 10d and then holds there.

## Your own cards

The **+** button adds a card with free-form front and back. No template, write whatever you want on either side. Your cards join the same review queue and can be deleted from the same sheet.

## Changing the colours

Three earthy palettes are defined at the top of `index.html`. Switch by editing one attribute on the `<html>` tag:

```html
<html lang="en" data-palette="moss">
```

- `fern` (current) cool near-black green, fresh mint accent
- `moss` deep forest base, sage green accent
- `clay` warm brown earth base, soft olive accent

Every colour in the app comes from those variables, so nothing else needs touching. If you change palette, also update the `theme-color` meta tag to match the new `--bg` so the iPhone status bar blends in.

## Editing the word list

`words.csv` is the source of truth. Columns:

```
word, part_of_speech, definition, russian_definition, english_synonyms, russian_synonyms, example
```

In `example`, wrap the target word in asterisks (`*exacerbate*`) and that span gets highlighted, whatever form the word takes in the sentence.

After editing the CSV, regenerate the data file:

```bash
powershell -File build.ps1
```

That writes `words.js`, which is what the app actually loads. Commit both.

## Notes

- Progress lives in the browser's localStorage, so it is per-device and survives closing the app. Clearing Safari website data wipes it.
- Russian text follows the house rule of no letter "e with diaeresis": always plain "е".
