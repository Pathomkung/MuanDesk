# Bundled UI dependency source snapshots

These unmodified upstream archives accompany the source for the JavaScript bundled into
MuanDesk's UI. They retain their upstream MIT license, included inside each archive and
in THIRD_PARTY_NOTICES.md. They are not relabeled as original GPL-authored MuanDesk code.

| Packages | npm version | Upstream commit | Source archive |
| --- | --- | --- | --- |
| React and React DOM | 19.3.1 | `61aa00df822d0eb76d0362eb8b6fdd3527693efe` | `react-19.3.1-sources.tar.gz` |
| Scheduler | 0.28.0 | `1d34f91dfde6bba84d08b683aaba164c7194dacb` | `scheduler-0.28.0-sources.tar.gz` |

The commit IDs come from the published packages' npm `gitHead` metadata. Downloaded from:

- https://codeload.github.com/react/react/tar.gz/61aa00df822d0eb76d0362eb8b6fdd3527693efe
- https://codeload.github.com/react/react/tar.gz/1d34f91dfde6bba84d08b683aaba164c7194dacb

Archive SHA-256 values and package mappings are recorded in `sources.json` and checked
before release. Update the source snapshots and mappings whenever bundled dependencies
change. Do not substitute unrelated current upstream sources for a released version.
