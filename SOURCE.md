# Source code and redistribution

MuanDesk 0.8.0 onward uses GPL-3.0-only for its original code and wave icon.
The full license is in LICENSE, and the project notice is in NOTICE.

## Getting the matching source

Each published Setup EXE must be accompanied on its release download page by the
`MuanDesk-VERSION-source.zip` for that exact version, or by clear, equally accessible
directions to that source. Do not publish the Setup EXE by itself. The source archive
includes the application source, lockfile, UI/icon build scripts, installer configuration,
tests, documentation and the bundled React/Scheduler source snapshots listed in
`third_party/README.md`. It contains no user profile or account data.

Provide source without an extra charge to recipients of the binary and keep it available
as required by GPLv3 section 6. Redistributors must retain required notices, disclose
relevant modifications, and meet the GPL obligations for their covered distributed work.
Private modifications that are not distributed do not require public publication.

## Building the application and installer

On Windows x64 with Node.js 22.12 or newer:

```powershell
npm ci
npm run build
npm run installer
```

`npm run release` additionally creates the matching source archive, SHA-256 checksums,
and privacy audit report. Node.js, npm, esbuild and electron-builder are unmodified,
general-purpose development tools and are obtained through the locked dependencies.

The installer does not require a private signing key or other secret to build or run a
modified application. These builds are unsigned. You may replace application code and
build your own version, subject to the applicable licenses.

## Third-party components

React, React DOM and Scheduler are bundled into the UI. Their preferred upstream source
snapshots, commits, archive hashes and original MIT notices are included in the source ZIP.
Keep those sources/notices available with the corresponding release.

The unmodified Electron runtime is distributed under its own license together with its
Chromium/Node.js notices. It is not represented as MuanDesk-authored GPL code. Upstream
runtime sources and licenses are available at:

- Electron: https://github.com/electron/electron/tree/v45.3.1
- Electron dependency sources: https://github.com/electron/electron/blob/v45.3.1/DEPS
- Chromium licensing: https://www.chromium.org/chromium-os/licenses/

Review all applicable upstream obligations when changing or redistributing dependencies;
the project's GPL notice does not replace their licenses. Music, cover artwork, website
content and Google/YouTube trademarks remain outside this project's license grant.
