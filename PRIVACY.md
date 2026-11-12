# Privacy

MuanDesk is an independent desktop companion that loads the real YouTube Music website.
It has no developer-operated server, telemetry endpoint, analytics SDK, or account database.

## Website and account data

The embedded website connects to Google/YouTube and their service providers. Those services
receive normal website requests, account sign-ins, playback activity and related data under
their own policies. MuanDesk is not an anonymous or offline player.

Passwords are entered on Google's website. MuanDesk does not implement password capture or
export, and its application code does not read or export session cookies. Chromium stores
website cookies, cache and local storage in a persistent local profile, separate from Chrome.
Uninstalling MuanDesk or deleting its application folder does not delete that profile or sign you out.

New installations use `%APPDATA%/MuanDesk`. An upgrade may reuse an existing local
`%APPDATA%/YT Music` profile if it has this application's previous EQ settings and website
partition. This avoids copying account data. Neither location is part of the release.
EQ preferences are stored locally in `equalizer.json` within the active profile.
The selected Thai/English interface language is stored in `language.json` in that same profile,
and is also excluded from releases. Changing it does not reload the embedded website.

## Local controls

The mini player reads the loaded page's track metadata and queue to display them locally.
Windows receives playback metadata through Chromium's Media Session integration. The
equalizer processes audio locally with Web Audio; it does not upload or save recordings.

## Diagnostics and contributions

Tests use temporary profiles and may create screenshots and diagnostic files in `artifacts/`.
These can contain personal page content and must not be published. Diagnostic navigation
tracing is off by default. `YTM_NAV_TRACE=1` logs origins, paths, status codes and permission
types; it deliberately omits request bodies, query strings, cookies and authorization headers.

Release scripts copy only files listed in `scripts/release-files.cjs`. They do not copy browser
profiles, `artifacts/`, `.env` files, logs or arbitrary files placed in the project directory.
The privacy scan is a pattern check, not a proof that every possible secret can be detected.
Review changes to the allowlist before release. Never attach profiles or unredacted screenshots
to public issues.
