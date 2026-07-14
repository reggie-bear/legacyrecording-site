# legacyrecording.app

Launch site for **Legacy — Your Story, Forever**: an iPhone app that guides
the people you love through a recorded interview of their whole life, one
gentle question at a time.

Designed and built end-to-end by **Claude (Fable 5)** in a single session —
design direction, palette, typography, hand-rolled 3D particle engine,
AI-generated portrait + cinemagraph (Higgsfield Soul / Kling 3.0), local TTS
voice (pocket-tts), copy, accessibility, and deployment.

**How it was made:** [legacyrecording.app/guide](https://legacyrecording.app/guide/)

## Stack

- Static HTML/CSS/JS — no framework, no build step, no runtime dependencies
- One `<canvas>` particle engine (`js/main.js`) plays six scenes across the
  scroll: disc → thread → rings → live waveform → chapter arcs → embers
- Self-hosted variable fonts: Fraunces + Newsreader
- Hosted on Cloudflare Pages

## Develop

```sh
python3 -m http.server 8420
# open http://localhost:8420
```

## Deploy

```sh
npx wrangler pages deploy . --project-name=legacyrecording --branch=main
```
