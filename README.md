# **[Rhythm-YoRHa](https://rhythm-yorha.pages.dev)**

A web-based rhythm game similar to Dance Dance Revolution or Osu!Mania that generates levels from any uploaded audio file with unique beatmaps for every new attempt.

**Design system is inspired by the YoRHa-UI from Nier: Automata, written for tailwind.**

**[Demo URL:](https://rhythm-yorha.pages.dev) <https://rhythm-yorha.pages.dev/>**

![Game Screenshot](src/assets/screenshot.gif)

## How to Run

```bash
git clone https://github.com/numinousv/rythm-spel.git
cd rythm-spel
bun install
bun run dev
```

Open `http://localhost:5173` in your browser.

## How to Play

1. Upload an audio file (MP3, WAV, OGG, etc.)
1. Choose a difficulty: Easy, Medium, Hard, or Extreme
1. Hit **D, F, J, K** in time with the music as notes scroll down, or if on mobile, simply tap the lanes where the notes appear.
1. View your results: score, accuracy, max combo, and a letter grade (S/A/B/C/D)
1. Retry for a new randomized variation, or go back and try a different song

Your last song is saved automatically - you can return and play it again later.

## How It Works

**Beat Detection** -- Audio is decoded with the Web Audio API, then `@audio/beat` DP beat tracking finds BPM and beat positions between 40 and 240 BPM, with a light fallback for sparse audio. Beats are quantized to a 1/16 grid and expanded to 16ths for charting. `meyda` loudness helps mark sustained sections for hold notes.

**Level Generation** -- Notes are placed on the quantized grid with seeded shuffling, so the same song and difficulty give a shareable chart, while Shuffle gives a fresh variation. Strong beats are favored, holds last 1 to 3 seconds on sustained parts, and lanes are balanced to avoid awkward repeats. Difficulty controls density, window, and scroll.

**Scoring** -- Timing accuracy per hit determines points, with a combo multiplier that increases every 10 consecutive hits.

**Sanity checker** -- Use the spectate mode to have it auto-play, helping you make sure that the map generated is actually in tune with the rhythm.

## Tech Stack

- **Language:** TypeScript
- **Framework:** React 19
- **Bundler:** Vite
- **Routing:** React Router
- **Rendering:** HTML5 Canvas (2D)
- **Styling:** Tailwind CSS 4
- **Audio:** Web Audio API, `@audio/beat` for beat tracking, `meyda` for sustain detection
- **Storage:** IndexedDB (audio blobs), localStorage (metadata)

## Known Issues

- Very large uncompressed WAV files (5MB+) may exceed storage limits
- Beat detection works best with rhythmic music; ambient or classical tracks may produce sparse note maps
