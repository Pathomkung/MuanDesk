---
title: Keep EQ makeup gain small
date: 2026-11-20
category: best-practices
module: Equalizer audio engine
problem_type: best_practice
component: frontend
severity: low
applies_when:
  - Changing EQ output gain or the peak compressor settings
tags: [equalizer, web-audio, gain]
---

# Keep EQ makeup gain small

The user prefers about 1% net amplitude boost on quiet material with EQ enabled. The Web Audio compressor adds its own makeup gain. With the current settings, Electron measured a 6.78% boost before the output trim.

Use the output gain in `src/audio-engine.cjs` to offset the compressor makeup on the enabled path. A −0.484 dB trim measured a 0.99% boost with a flat EQ and a 200 Hz sine at 0.1 amplitude. The bypass path measured unity.

When changing the compressor threshold, knee, or ratio, compare the RMS output of the same quiet signal with EQ enabled and bypassed. Run `npm run test:equalizer` to check peak limiting and recovery separately.
