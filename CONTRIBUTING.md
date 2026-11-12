# Contributing

Use Windows x64 and Node.js 22.12 or newer. Run `npm ci` and `npm start`.
Keep changes focused and describe the user-visible behavior and validation in your pull request.

Run `npm run test:navigation`, `npm run test:queue`, `npm run test:equalizer`, and
`npm run test:main-equalizer`. Changes to playback or windows also need `npm test` and
`npm run test:mini`; those tests access the real website and can depend on region, network
conditions and advertisements. Audio tests produce sound. Avoid running tests that manipulate
Windows media sessions at the same time as unrelated audio applications.

Never add account data, profiles, tokens, personal screenshots or logs. Do not modify the app
to bypass login security, service access controls, advertisements or subscription restrictions.
Changes to published files must also update the source/runtime allowlists in
`scripts/release-files.cjs` and pass `npm run release:check`.

The original wave icon is in `assets/icon.svg`. Run `npm run icons` to regenerate transparent
PNG/ICO assets. Do not replace it with Google/YouTube branding. Contributions are provided
under the project's GPL-3.0-only license; preserve third-party license notices.

`npm run screenshots` captures the main window, mini player and equalizer from the real
website using a fresh signed-out profile. It requires internet access and may wait for ads.
Inspect all three images for personal information before committing them.
`npm run installer` creates the NSIS setup. `npm run test:installer` installs, launches and
uninstalls it in a temporary directory on Windows; run it on a clean Windows user or VM
without an existing MuanDesk installation or shortcuts, since it exercises Windows registration.

