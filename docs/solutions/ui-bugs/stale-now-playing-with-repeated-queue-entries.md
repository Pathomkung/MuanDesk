---
title: Stale Now playing row with repeated queue entries
date: 2026-11-20
category: ui-bugs
module: Mini player queue
problem_type: ui_bug
component: frontend
severity: medium
symptoms:
  - The previous track remains in Up next after playback advances.
  - The previous and current tracks both show Now playing.
root_cause: logic_error
resolution_type: code_fix
tags: [electron, react, playback-queue]
---

# Stale Now playing row with repeated queue entries

## Problem

The mini player retained the previous track in Up next when that track shared a queue key with a later entry. The playback snapshot marked one current track, but the rendered list showed two.

## Root cause

The mini player used the queue's selection key as its React key. The queue can contain multiple rows with the same selection key. When the visible list started at the next track, React could leave the previous row in the DOM.

## Solution

In `src/mini/app.jsx`, combine the selection key with the track's position in the full queue for the React key. Use `queueStart + index` so rows that stay in the same full-queue position keep their keys when Up next advances. Pass the original key to the playback selection command.

## Prevention

Run `npm run test:queue` when changing how the mini player renders the queue. The Electron test advances from an entry that shares a key with a later repeat. It checks that the old row disappears, only the active row shows Now playing, and the later repeat remains.
