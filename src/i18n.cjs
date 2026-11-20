// SPDX-License-Identifier: GPL-3.0-only
const strings = {
  th: {
    language: 'ภาษา', openEq: 'เปิด Equalizer', enableEq: 'เปิดใช้งาน Equalizer', resetEq: 'คืนค่า Equalizer เป็นปกติ',
    presets: 'พรีเซ็ตเสียง', custom: 'ปรับเอง', flat: 'ปกติ', bass: 'เพิ่มเบส', vocal: 'เสียงร้อง', rock: 'ร็อก', pop: 'ป๊อป',
    bands: 'ย่านความถี่', bassRange: 'เบส', midRange: 'เสียงกลาง', trebleRange: 'เสียงแหลม', bandCount: '10 ย่าน',
    hideCard: 'ซ่อนการ์ด', openPlayer: 'เปิดหน้าต่าง YouTube Music', nowPlaying: 'กำลังเล่น', chooseSong: 'เลือกเพลงเพื่อเริ่มฟัง',
    chooseInPlayer: 'เปิด YouTube Music เพื่อเลือกเพลง', ad: 'โฆษณา', previous: 'เพลงก่อนหน้า', next: 'เพลงถัดไป',
    play: 'เล่น', pause: 'หยุดชั่วคราว', seekPosition: 'ตำแหน่งการเล่น', progressValue: '{elapsed} จาก {duration}', upNext: 'เพลงถัดไป', songs: '{count} เพลง',
    queue: 'คิวเพลง', chooseToPlay: 'เลือกเพลงเพื่อเล่นทันที', songList: 'รายการเพลง', emptyQueue: 'ยังไม่มีคิวเพลง เปิดแอปแล้วเลือกเพลงหรือเพลย์ลิสต์',
    connectionError: 'เชื่อมต่อกับตัวเล่นไม่ได้', trayTip: 'MuanDesk • คลิกเพื่อเปิดการ์ดเพลง', openApp: 'เปิด MuanDesk',
    togglePlayback: 'เล่น / หยุด', quit: 'ออกจากแอป', playerStopped: 'ตัวเล่นเพลงหยุดทำงาน', reloadPlayer: 'กด Ctrl+R เพื่อเปิดใหม่',
    openFailed: 'เปิด YouTube Music ไม่สำเร็จ', checkConnection: 'ตรวจสอบอินเทอร์เน็ต แล้วกด Ctrl+R เพื่อลองอีกครั้ง',
    staleQueue: 'รายการเพลงเปลี่ยนแล้ว กรุณาเลือกอีกครั้ง', selectFirst: 'เปิด YouTube Music แล้วเลือกเพลงก่อน', seekFailed: 'กรอเพลงไม่สำเร็จ',
    invalidGains: 'ค่า Equalizer ต้องอยู่ระหว่าง -12 ถึง +12 dB ทั้ง 10 ย่าน', invalidPreset: 'พรีเซ็ตไม่ถูกต้อง', invalidCustom: 'ค่าปรับเองไม่ถูกต้อง',
  },
  en: {
    language: 'Language', openEq: 'Open equalizer', enableEq: 'Enable equalizer', resetEq: 'Reset equalizer',
    presets: 'Sound preset', custom: 'Custom', flat: 'Flat', bass: 'Bass boost', vocal: 'Vocals', rock: 'Rock', pop: 'Pop',
    bands: 'Frequency bands', bassRange: 'Bass', midRange: 'Mids', trebleRange: 'Treble', bandCount: '10 BAND',
    hideCard: 'Hide mini player', openPlayer: 'Open YouTube Music', nowPlaying: 'Now playing', chooseSong: 'Choose a song to start',
    chooseInPlayer: 'Open YouTube Music to choose a song', ad: 'Advertisement', previous: 'Previous track', next: 'Next track',
    play: 'Play', pause: 'Pause', seekPosition: 'Playback position', progressValue: '{elapsed} of {duration}', upNext: 'Up next', songs: '{count} tracks',
    queue: 'Play queue', chooseToPlay: 'Choose a song to play', songList: 'Track list', emptyQueue: 'No songs in the queue. Open the player and choose a song or playlist.',
    connectionError: 'Cannot connect to the player', trayTip: 'MuanDesk • Click to open mini player', openApp: 'Open MuanDesk',
    togglePlayback: 'Play / Pause', quit: 'Quit', playerStopped: 'The music player stopped', reloadPlayer: 'Press Ctrl+R to reload',
    openFailed: 'Could not open YouTube Music', checkConnection: 'Check your connection and press Ctrl+R to try again',
    staleQueue: 'The queue changed. Please select the song again.', selectFirst: 'Open YouTube Music and choose a song first.', seekFailed: 'Couldn’t seek',
    invalidGains: 'Equalizer gains must be between -12 and +12 dB for all 10 bands.', invalidPreset: 'Invalid preset', invalidCustom: 'Invalid custom settings',
  },
};
function translate(language, key, values = {}) {
  const text = strings[language]?.[key] ?? strings.th[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}
function translateError(language, message) {
  for (const key of ['connectionError', 'staleQueue', 'selectFirst', 'seekFailed', 'invalidGains', 'invalidPreset', 'invalidCustom', 'playerStopped', 'openFailed']) {
    if (message === key || message?.includes(strings.th[key])) return translate(language, key);
  }
  return message;
}
module.exports = { strings, translate, translateError };

