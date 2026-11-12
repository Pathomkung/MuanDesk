# Preparing a GitHub release

This process builds files locally. It does not create a GitHub repository or publish a release.

1. Update the version in `package.json` and run `npm install --package-lock-only`.
2. Review `CHANGELOG.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, and both allowlists in
   `scripts/release-files.cjs`. Update third-party notices if bundled React packages change.
3. Run `npm ci`, `npm audit`, and the relevant tests listed in `CONTRIBUTING.md`.
4. Close the packaged MuanDesk application, then run `npm run release` on Windows x64.
5. Inspect `dist/releases/RELEASE-AUDIT.json` and verify the ZIP contents and hashes.
6. Extract the source ZIP into a clean folder for your public repository. It includes source,
   tests, documentation, license files and CI configuration. It excludes local artifacts,
   browser profiles, generated UI bundles and Windows binaries. Do not upload the entire
   development folder or an older `dist/` build.
7. Create a GitHub repository and push that clean folder. Enable private vulnerability
   reporting in its settings. Upload the versioned setup EXE, `SHA256SUMS.txt` and
   audit report as release assets. Attach the matching source ZIP alongside the Setup EXE;
   keep source available to recipients as required by GPLv3 section 6. Do not publish only
   a binary or an unrelated newer source snapshot. See SOURCE.md.

The source ZIP includes pinned upstream React/React DOM and Scheduler source archives.
`third_party/sources.json` ties them to lockfile versions and SHA-256 hashes. Update those
archives/records when changing bundled dependencies. Do not relabel their MIT notices as GPL.

`dist/releases/MuanDesk-Setup-VERSION-x64.exe` is an offline NSIS installer built from the
audited `dist/MuanDesk-win32-x64` application payload. It creates Desktop/Start Menu shortcuts,
supports uninstalling through Windows, and leaves local AppData preferences/account data intact.
The installer and source ZIP are never built from the user's AppData profile. Electron and
Chromium license notices are installed with the application. Builder logs/intermediate files
stay in `dist/installer` and are not copied to the release assets.

README images live in `docs/screenshots`. Generate them only with `npm run screenshots`,
which uses the real website in a fresh signed-out profile. Review every image
visually before release. Arbitrary `artifacts/` screenshots remain excluded.

Archive creation refuses to overwrite an existing ZIP. If rebuilding the same version,
inspect and remove only that version's exact archives first, or use a new version number.

The release scan detects known secret formats, common personal account email addresses,
local Windows home paths and prohibited profile filenames. It is not a general legal,
security or privacy certification. The independent name/icon reduce brand confusion but
do not grant permission to use YouTube's service or guarantee trademark clearance.
