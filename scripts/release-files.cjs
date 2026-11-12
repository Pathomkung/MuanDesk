// SPDX-License-Identifier: GPL-3.0-only
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const runtime = [
  'package.json', 'LICENSE', 'NOTICE', 'SOURCE.md', 'README.md', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md',
  'assets/icon.png', 'assets/icon.ico', 'assets/icon.svg', 'assets/google-domains.txt', 'assets/README.md',
  'docs/screenshots/main-window.png', 'docs/screenshots/mini-player.png', 'docs/screenshots/equalizer.png',
  'src/main.cjs', 'src/profile.cjs', 'src/i18n.cjs', 'src/language.cjs', 'src/audio-engine.cjs', 'src/equalizer.cjs', 'src/equalizer-window.cjs',
  'src/mini-player.cjs', 'src/navigation.cjs', 'src/youtube.cjs',
  'src/mini/app.bundle.js', 'src/mini/app.bundle.js.LEGAL.txt', 'src/mini/index.html', 'src/mini/equalizer.html',
  'src/mini/style.css', 'src/mini/preload.cjs', 'src/mini/equalizer-preload.cjs',
  'src/titlebar/index.html', 'src/titlebar/style.css', 'src/titlebar/preload.cjs', 'src/titlebar/language.html', 'src/titlebar/language-preload.cjs',
];
const source = [
  ...runtime.filter(file => !file.includes('app.bundle.js')), 'src/mini/app.jsx',
  'package-lock.json', 'electron-builder.json', '.gitignore', '.gitattributes', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md',
  'docs/RELEASING.md', 'Start MuanDesk.cmd', '.github/workflows/ci.yml',
  'scripts/build-ui.cjs', 'scripts/build-icon.ps1', 'scripts/render-icon.cjs',
  'scripts/release-files.cjs', 'scripts/audit-release.cjs', 'scripts/package.cjs', 'scripts/release.cjs', 'scripts/archive.ps1',
  'scripts/installer.cjs', 'scripts/screenshots.cjs',
  'test/smoke.cjs', 'test/live-playback.cjs', 'test/mini.cjs', 'test/equalizer.cjs', 'test/artwork.cjs',
  'test/login.cjs', 'test/queue.cjs', 'test/navigation.test.cjs', 'test/main-equalizer.cjs',
  'test/media-session.ps1', 'test/player.html', 'test/release.test.cjs', 'test/language.cjs',
  'test/installer.ps1',
  'third_party/README.md', 'third_party/sources.json',
  'third_party/react-19.3.1-sources.tar.gz', 'third_party/scheduler-0.28.0-sources.tar.gz',
];
function copyFiles(files, destination) {
  for (const file of files) {
    const input = path.join(root, file), output = path.join(destination, file);
    if (!fs.lstatSync(input).isFile() || fs.lstatSync(input).isSymbolicLink()) throw Error(`Not a regular release file: ${file}`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(input, output);
  }
}
module.exports = { root, runtime, source, copyFiles };

