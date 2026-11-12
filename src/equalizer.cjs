// SPDX-License-Identifier: GPL-3.0-only
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const { applyAudioSettings } = require('./audio-engine.cjs');

const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const presets = [
  { id: 'flat', label: 'ปกติ', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'bass', label: 'เพิ่มเบส', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { id: 'vocal', label: 'เสียงร้อง', gains: [-3, -2, -1, 0, 2, 4, 4, 2, 0, -1] },
  { id: 'rock', label: 'ร็อก', gains: [4, 3, 1, -1, -2, 0, 2, 3, 4, 3] },
  { id: 'pop', label: 'ป๊อป', gains: [-1, 0, 2, 3, 3, 2, 0, -1, 1, 2] },
];

function validateSettings(value) {
  if (!value || typeof value.enabled !== 'boolean' || !Array.isArray(value.gains) || value.gains.length !== frequencies.length
    || !value.gains.every(gain => typeof gain === 'number' && Number.isFinite(gain) && gain >= -12 && gain <= 12)) {
    throw new Error('ค่า Equalizer ต้องอยู่ระหว่าง -12 ถึง +12 dB ทั้ง 10 ย่าน');
  }
  const preset = value.preset ?? presets.find(item => item.gains.every((gain, index) => gain === value.gains[index]))?.id ?? 'custom';
  if (preset !== 'custom' && !presets.some(item => item.id === preset)) throw new Error('พรีเซ็ตไม่ถูกต้อง');
  const customGains = value.customGains ?? (preset === 'custom' ? value.gains : presets[0].gains);
  if (!Array.isArray(customGains) || customGains.length !== frequencies.length
    || !customGains.every(gain => typeof gain === 'number' && Number.isFinite(gain) && gain >= -12 && gain <= 12)) throw new Error('ค่าปรับเองไม่ถูกต้อง');
  const gains = preset === 'custom' ? customGains : presets.find(item => item.id === preset).gains;
  return { enabled: value.enabled, preset, gains: [...gains], customGains: [...customGains] };
}

function createEqualizer(win) {
  const file = path.join(app.getPath('userData'), 'equalizer.json');
  let settings = validateSettings({ enabled: false, gains: [...presets[0].gains] });
  try { settings = validateSettings(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch {}
  let status = { state: settings.enabled ? 'waiting' : 'off' };
  async function apply() {
    if (!win.webContents.getURL().startsWith('https://music.youtube.com/')) {
      status = { state: settings.enabled ? 'waiting' : 'off' }; return;
    }
    try {
      status = await win.webContents.executeJavaScript(`(${applyAudioSettings.toString()})(${JSON.stringify(settings)},${JSON.stringify(frequencies)})`, true);
    } catch { status = { state: 'error' }; }
  }
  const onLoad = () => { apply().catch(console.error); };
  win.webContents.on('did-finish-load', onLoad);
  return {
    async get() { await apply(); return { settings, frequencies, presets, status }; },
    async set(value) {
      const next = validateSettings(value);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(next));
      fs.renameSync(`${file}.tmp`, file);
      settings = next; await apply();
      return { settings, frequencies, presets, status };
    },
    dispose() { win.webContents.removeListener('did-finish-load', onLoad); },
  };
}

module.exports = { createEqualizer, validateSettings };


