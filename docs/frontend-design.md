# MuanDesk frontend design

Design D1 and requirements R1 are approved for the tray mini-player timeline.

## System Analyst review

MuanDesk listeners use the tray mini player while the main YouTube Music window is visible or hidden. Before R1, the [mini-player timeline](../src/mini/app.jsx) displayed progress without a seek command in the [mini-player bridge](../src/mini/preload.cjs) or [command handler](../src/mini-player.cjs).

### Requirements approval

On 2026-11-20 the user approved R1 in chat with “อนุมัติ R1 ส่งแบบแถบเวลาในมินิเพลเยอร์มาให้ดูได้เลย”.

| ID | User action or condition | Observable outcome |
| --- | --- | --- |
| R1.1 | Click the timeline or drag and release on a seekable song. | The actual player moves to the chosen time, including while the main window is hidden. The elapsed label previews the target during a drag. The seek takes effect on release. |
| R1.2 | Focus the timeline and press Left, Right, Home, or End. | Left and Right move by 5 seconds within the seekable range. Home and End go to the beginning and end of that range. |
| R1.3 | Seek during playback or while paused. | The playing song continues from the chosen time. A paused song stays paused at the chosen time. Normal end-of-track behavior applies at the end. |
| R1.4 | Open before a song is ready, during an ad, or with no valid seekable range. | The timeline displays available timing and disables seeking. |
| R1.5 | Change tracks during a drag, including a change to another occurrence of a repeated song. | The preview clears and the timeline follows the current track. The old gesture sends no seek to the new track. |
| R1.6 | The player rejects a seek. | The elapsed label returns to the actual position and the mini player shows a short error in Thai or English. |
| R1.7 | Advance playback with a repeated song still in the queue. | Up next removes the previous occurrence, marks the current occurrence, and keeps the later repeat. The existing [queue regression test](../test/queue.cjs) covers the transition. |

| Handoff | Owner | Evidence and next owner |
| --- | --- | --- |
| Requirements | Business Analyst and System Analyst | R1 approved. Handed to the Product Designer and primary Codex. |
| Design | Product Designer and primary Codex | D1 wireframes and component tree approved. Handed to the primary Codex for implementation planning. |
| Build | Poteto feature worker | One production owner for the renderer, preload, and playback adapter. The primary Codex owns the Electron acceptance test and verifies the integrated feature. |
| Verify | Primary Codex | R1 passed locally. See the acceptance evidence below. |

## Technology choices

| Layer | Choice | Source |
| --- | --- | --- |
| UI and build | React, Electron renderer, and esbuild | Existing [app](../src/mini/app.jsx) and [build script](../scripts/build-ui.cjs). |
| Player integration | Electron preload and the existing mini-player IPC handler | Existing mini-player command path to [YouTube Music](../src/youtube.cjs). |
| Styling and controls | Plain CSS, existing theme colors and focus style, and a native range input | Existing [mini-player stylesheet](../src/mini/style.css) and native inputs within the equalizer. The horizontal timeline is specific to playback. |

## Screen wireframes

### Compact mini player

```text
┌────────────────────────────────────┐
│ MuanDesk                    EQ ↗ × │
│ [Cover]  Song title                │
│          Artist                    │
│           ◀     ⏸     ▶            │
│  0:42  ━━━●────────────────  4:52  │
│ Up next                          ⌄ │
└────────────────────────────────────┘
```

### Expanded mini player on a narrow display

```text
┌────────────────────────────┐
│ MuanDesk            EQ ↗ × │
│ [Cover]  Song title…       │
│          Artist            │
│       ◀     ⏸     ▶        │
│ 2:05  ━━━━━●───────  4:52  │
│ Up next                  ⌃ │
│ Now playing · Song title   │
│ Next song                  │
└────────────────────────────┘
```

The existing desktop popup targets 380 × 238 px when compact and up to 380 × 588 px when expanded. Both are capped by the display work area. Keep the time labels at the ends and let the slider shrink between them. The timeline stays above the queue as the queue scrolls. MuanDesk has one Windows desktop layout that adapts to available width.

| State | Timeline and feedback |
| --- | --- |
| Ready | Show elapsed and total time around a thin rail with a visible pink thumb. Increase thumb contrast on hover. The pointer target is at least 24 px high. Use 6 px of spacing beneath the row in the compact layout. |
| Keyboard focus | Use the existing pink focus outline. Tab from Next track to the timeline and then to Up next. Announce a localized playback-position label and value, such as “2:05 จาก 4:52”. |
| Drag and pending seek | Move the thumb and show the chosen time in the elapsed label. Keep the preview until release and then until the player answers. Resume displaying the player's position once it confirms the seek. |
| Loading, empty, ad, or no seekable range | Show a muted rail without a thumb. Show available times and use `–:––` for unavailable values. Tab skips the disabled slider. |
| Track changes during drag | Clear the preview and show the new track's position. |
| Seek fails | Return to the actual position. Use the existing status area for “กรอเพลงไม่สำเร็จ” or “Couldn’t seek”. |

Use the existing pink accent `--accent` and focus outline. Give the enabled rail a contrasting neutral tone and use the existing darker rail for the disabled state.

## Component structure

```text
Mini player window · src/mini/index.html
└─ LanguageProvider · existing, shared
   └─ App · existing, mini player
      ├─ Header and transport · existing, use shared IconButton
      ├─ Now playing · existing, uses shared Cover
      ├─ PlaybackTimeline · proposed, mini player
      │  ├─ Elapsed or preview time
      │  ├─ Native horizontal range input
      │  └─ Total time
      ├─ Up next and equalizer panels · existing
      └─ Status message · existing, receives seek errors
```

`App` owns the current player snapshot and the existing error status. `PlaybackTimeline` owns the local gesture preview and uses the current playback occurrence to detect when it expires. Its inputs are elapsed time, total time, seek availability, playback occurrence, and a seek action. Use the existing language provider for labels, values, and errors.

## Architecture and validation

- The mini renderer sends the target time with the expected playback occurrence through its restricted preload. The command handler checks that the request is still for the current playable occurrence before applying it. It distinguishes repeated queue entries by full-queue position. The existing snapshot reader refreshes the actual time before the UI dismisses a failed or stale seek preview.
- Verify click-to-seek first against actual media in Electron with the main window hidden. Then exercise drag and release, the keyboard, playing and paused states, disabled states, the stale-track and failure paths, and the repeated-queue regression.
- Inspect compact, expanded, and narrow desktop layouts. Build the production UI and run the relevant Electron checks in the project's Windows CI workflow.

### Verification evidence

| Scope | Local result |
| --- | --- |
| R1.1 through R1.3 | Passed `npm run test:seek` with playable local media in Electron. Click, drag, keyboard, and simulated touch moved actual playback. The player retained its play or pause state. A separate signed-out YouTube Music run confirmed click-to-seek while playing with the main window hidden. |
| R1.4 through R1.6 | Passed the loading, ad, unseekable media, duplicate occurrence, and failure cases in [the seek test](../test/seek.cjs). The failure case displays the latest actual playback time and the localized status message. |
| R1.7 | Passed `npm run test:queue`, including advancing past a repeated entry. |
| D1 | Passed layout checks at 380 px compact and 300 px expanded. Checked the tab order and the localized accessible name. |
| Related checks | Passed the production UI build and the language, main equalizer, equalizer, navigation, and release source tests. The [Windows workflow](../.github/workflows/ci.yml) includes `npm run test:seek`. |

## Wireframe and component design approval

D1 covers the timeline, its interaction states, and the component structure above. On 2026-11-20 the user approved it in chat with “อนุมัติ D1 ลงมือทำแถบกรอเพลงในมินิเพลเยอร์ตามแบบได้เลย”.
