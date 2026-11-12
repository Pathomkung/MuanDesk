// SPDX-License-Identifier: GPL-3.0-only
const fs = require('node:fs');
const path = require('node:path');

function configureProfile(app) {
  const current = path.join(app.getPath('appData'), 'MuanDesk');
  const legacy = path.join(app.getPath('appData'), 'YT Music');
  const existingLegacy = fs.existsSync(path.join(legacy, 'equalizer.json')) && fs.existsSync(path.join(legacy, 'Partitions', 'ytmusic'));
  const existingCurrent = fs.existsSync(path.join(current, 'Partitions', 'ytmusic'));
  // Reuse an existing local profile without copying it into the application.
  app.setPath('userData', !existingCurrent && existingLegacy ? legacy : current);
}
module.exports = { configureProfile };

