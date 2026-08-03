# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Asteroids arcade clone on raw HTML5 Canvas. No dependencies, no bundler, no build step, no test suite, no package.json.

## Running

Open `index.html` directly in a browser, or serve the folder:

```bash
npx serve .   # then http://localhost:3000
```

There is nothing to build, lint, or test. Changes are verified by reloading the page.

## Architecture

Three files matter: `index.html` (fixed 800×600 canvas + inline CSS), `game.js` (everything else), `favicon.svg`.

`game.js` is a single IIFE-less global script in `'use strict'`, laid out in section-comment blocks:

1. **Input** — `keys` (held) vs `justPressed` (edge). `pressed(code)` consumes the edge flag, so it fires once per physical keypress; use it for discrete actions (shoot, restart) and read `keys[...]` directly for continuous ones (rotate, thrust).
2. **Utils** — `wrap` implements the toroidal playfield; every moving entity wraps against module constants `W`/`H`.
3. **Entities** — `Bullet`, `Asteroid`, `Ship`, `Particle`. All follow the same contract: `update(dt)`, `draw()`, and a `dead` boolean. Nothing removes itself; the main loop filters dead entities out of its arrays.
4. **Game state** — module-level `ship, bullets, asteroids, particles, score, lives, level, state, deadTimer`. `state` is a string machine: `'playing' | 'dead' | 'gameover'`, branched at the top of `update()`.
5. **Update / Draw / Loop** — `loop(ts)` computes `dt` in seconds, clamped to `0.05` so a backgrounded tab can't tunnel entities through each other.

Key conventions to preserve when editing:

- **Everything is time-based, never frame-based.** Speeds are px/s, rotations rad/s, thrust px/s². Multiply by `dt`, never assume 60fps.
- **Asteroid size is an index, not a magnitude.** Sizes are `1|2|3` and index the parallel arrays `RADII`, `SPEEDS`, `POINTS` (slot `0` is a dummy). Adding a size means extending all three arrays consistently.
- **Draw calls are canvas-transform based** — `ctx.save()` → `translate` → `rotate` → draw local-space geometry → `ctx.restore()`. Entity vertices are stored relative to the entity origin.
- **Collision is circle-vs-circle** via `dist()`. Ship-vs-asteroid deliberately uses `a.radius * 0.82` to feel fair against the irregular polygon silhouette.
- Splitting happens inside the bullet loop but new fragments are collected in `newAsteroids` and concatenated after, so a fragment can't be hit by the same bullet pass.

## Notes

- UI strings rendered on the canvas are in Spanish (`NIVEL`, `PUNTAJE`, `ESPACIO PARA REINICIAR`); match that language when adding HUD or overlay text. Code identifiers and comments stay as-is: identifiers in English, section comments in Spanish.
- The README advertises power-ups and a shooting-star asteroid type. Neither exists in `game.js` — treat the README as aspirational on those points, not as a description of current behavior.
