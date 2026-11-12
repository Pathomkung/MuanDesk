// SPDX-License-Identifier: GPL-3.0-only
const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'ytmusic-eq-')));
const { createPlayer } = require('../src/main.cjs');
const { createEqualizer, validateSettings } = require('../src/equalizer.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 40; i++) { if (await check()) return; await delay(100); }
  throw new Error(message);
}
const fixture = `<!doctype html><meta charset="utf-8"><title>EQ audio test</title><video></video><script>
const rate=48000,count=rate*4,b=new ArrayBuffer(44+count*2),v=new DataView(b);
function s(o,t){for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));}
s(0,'RIFF');v.setUint32(4,36+count*2,true);s(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,count*2,true);
for(let i=0;i<count;i++)v.setInt16(44+i*2,1800*(Math.sin(2*Math.PI*125*i/rate)+Math.sin(2*Math.PI*4000*i/rate)),true);
const media=document.querySelector('video');media.src=URL.createObjectURL(new Blob([b],{type:'audio/wav'}));media.loop=true;media.volume=.15;
navigator.mediaSession.metadata=new MediaMetadata({title:'Equalizer test',artist:'Local tones'});
window.sample=async()=>{
 const engine=window[Symbol.for('ytmusic-tray.equalizer')];
 if(!window.analyser){window.analyser=engine.context.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=0;engine.output.connect(analyser);}
 await new Promise(r=>setTimeout(r,350));
 const bins=new Float32Array(analyser.frequencyBinCount);analyser.getFloatFrequencyData(bins);
 const at=f=>bins[Math.round(f/engine.context.sampleRate*analyser.fftSize)];
 const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);
 return {low:at(125),high:at(4000),state:engine.context.state,peak:Math.max(...samples.map(Math.abs)),reduction:engine.limiter?.reduction};
};
</script>`;
app.whenReady().then(async () => {
  const { player, win, mini, equalizer } = createPlayer();
  const remote = code => player.webContents.executeJavaScript(code, true);
  const ui = code => mini.popup.webContents.executeJavaScript(code, true);
  try {
    assert.throws(() => validateSettings({ enabled: true, gains: Array(10).fill(13) }));
    assert.throws(() => validateSettings({ enabled: true, gains: Array(10).fill(NaN) }));
    assert.throws(() => validateSettings({ enabled: true, gains: [0] }));
    assert.throws(() => validateSettings({ enabled: true, gains: Array(10).fill(0), preset: 'missing' }));
    assert.throws(() => validateSettings({ enabled: true, gains: Array(10).fill(0), customGains: Array(10).fill(99) }));
    assert.equal(validateSettings({ enabled: true, gains: [4, 3, 1, -1, -2, 0, 2, 3, 4, 3] }).preset, 'rock', 'Old settings migrate to selected preset');
    await player.webContents.session.protocol.handle('https', () => new Response(fixture, { headers: { 'content-type': 'text/html' } }));
    await player.webContents.loadURL('https://music.youtube.com/');
    await remote(`document.querySelector('video').play()`);
    win.hide(); await mini.open();
    await ui(`document.querySelector('#eq-button').click()`);
    await until(() => ui(`document.querySelectorAll('.eq-band input').length === 10`), 'EQ sliders missing');
    assert.equal(await ui(`document.querySelector('#eq-enabled').checked`), false);
    await ui(`document.querySelector('#eq-enabled').click()`);
    await until(async () => (await equalizer.get()).status.state === 'active', 'Audio processing not active');
    let baseline;
    await until(async () => { baseline = await remote('window.sample()'); return baseline.low > -90 && baseline.high > -90; }, 'Audio fixture did not reach steady output');
    assert.equal(baseline.state, 'running');
    assert.ok(Number.isFinite(baseline.low) && baseline.low > -90, JSON.stringify(baseline));
    await ui(`const slider=document.querySelector('#eq-band-2');slider.value=12;slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}))`);
    await until(async () => (await equalizer.get()).settings.gains[2] === 12, 'Slider gain not applied');
    const boosted = await remote('window.sample()');
    assert.ok(boosted.low - boosted.high > baseline.low - baseline.high + 10, JSON.stringify({ baseline, boosted }));
    assert.ok(boosted.high > baseline.high - 1, 'Boosting bass must not turn down the unboosted high band: ' + JSON.stringify({ baseline, boosted }));
    await ui(`document.querySelector('#eq-enabled').click()`);
    await until(async () => !(await equalizer.get()).settings.enabled, 'Bypass not applied');
    const bypassed = await remote('window.sample()');
    assert.ok(Math.abs(bypassed.low - baseline.low) < 1 && Math.abs(bypassed.high - baseline.high) < 1, JSON.stringify({ baseline, bypassed }));
    await equalizer.set({ ...(await equalizer.get()).settings, enabled: true });
    await remote(`{
      document.querySelector('video').pause();
      const engine=window[Symbol.for('ytmusic-tray.equalizer')];
      window.loudTone=engine.context.createOscillator();loudTone.frequency.value=125;
      window.loudGain=engine.context.createGain();loudGain.gain.value=.75;
      loudTone.connect(loudGain);loudGain.connect(engine.filters[0]);loudTone.start();
    }`);
    await delay(800);
    const limited = await remote('window.sample()');
    assert.ok(limited.reduction < -6, 'Loud boosted signal should trigger peak compression: ' + JSON.stringify(limited));
    assert.ok(limited.peak > .5 && limited.peak < 1.1, 'Peak compression should restrain loud signal without excessive attenuation: ' + JSON.stringify(limited));
    await remote(`loudTone.stop();loudGain.disconnect();document.querySelector('video').play()`);
    await delay(700);
    const recovered = await remote('window.sample()');
    assert.ok(recovered.reduction > -1 && recovered.high > baseline.high - 1, 'Quiet audio level should recover after loud peak: ' + JSON.stringify(recovered));
    await equalizer.set({ ...(await equalizer.get()).settings, enabled: false });
    await until(() => ui(`document.querySelector('#eq-enabled').checked === false`), 'Bypass UI did not refresh');
    console.log('PASS: bass boost preserves unboosted volume; loud peaks are compressed and quiet audio recovers');
    console.log('PASS: real media output changes at 125 Hz through slider; bypass restores original levels');
    await ui(`document.querySelector('#eq-enabled').click()`);
    const choosePreset = async id => {
      await ui(`document.querySelector('#eq-preset').click()`);
      await until(() => ui(`!!document.querySelector('#eq-option-${id}')`), 'Custom preset menu missing');
      await ui(`document.querySelector('#eq-option-${id}').click()`);
      await until(async () => (await equalizer.get()).settings.preset === id, `Preset ${id} not saved`);
    };
    await choosePreset('vocal');
    await until(async () => (await equalizer.get()).settings.gains[5] === 4, 'Vocal preset not applied');
    assert.equal(await ui(`!!document.querySelector('select')`), false, 'Preset menu should not use native select');
    await ui(`document.querySelector('#eq-preset').focus();document.querySelector('#eq-preset').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);
    await until(() => ui(`document.querySelector('#eq-preset').getAttribute('aria-expanded') === 'true'`), 'Arrow key did not open menu');
    await ui(`document.querySelector('#eq-preset').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
    await until(async () => (await equalizer.get()).settings.preset === 'rock', 'Keyboard selection did not choose next preset');
    await ui(`document.querySelector('#eq-preset').click()`);
    await until(() => ui(`!!document.querySelector('#eq-preset-list')`), 'Menu not open');
    await ui(`document.querySelector('#eq-preset').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`);
    await until(() => ui(`!document.querySelector('#eq-preset-list')`), 'Escape should dismiss menu');
    assert.equal(mini.popup.isVisible(), true, 'First Escape should preserve mini card');
    await ui(`document.querySelector('#eq-preset').click()`);
    await until(() => ui(`!!document.querySelector('#eq-preset-list')`), 'Menu not open');
    await ui(`document.querySelector('.eq-heading').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
    await until(() => ui(`!document.querySelector('#eq-preset-list')`), 'Outside click should dismiss menu');
    console.log('PASS: custom dropdown, keyboard selection, Escape and outside dismissal');
    await choosePreset('rock');
    await choosePreset('custom');
    await delay(1200);
    assert.equal(await ui(`document.querySelector('#eq-preset').dataset.value`), 'custom', 'Custom must not jump back to a matching named preset');
    assert.equal((await equalizer.get()).settings.gains[2], 12, 'Custom recalls last manual slider values');
    await ui(`{const band=document.querySelector('#eq-band-0');band.value=7;band.dispatchEvent(new Event('input',{bubbles:true}));}`);
    await until(async () => (await equalizer.get()).settings.customGains[0] === 7, 'Manual edit not remembered');
    await choosePreset('rock');
    await choosePreset('custom');
    assert.equal((await equalizer.get()).settings.gains[0], 7);
    await choosePreset('flat');
    await ui(`document.querySelector('#eq-reset').click()`);
    await until(async () => (await equalizer.get()).settings.preset === 'custom', 'Reset should keep custom even when values match flat');
    await delay(1200);
    assert.equal(await ui(`document.querySelector('#eq-preset').dataset.value`), 'custom');
    await ui(`{const band=document.querySelector('#eq-band-0');band.value=7;band.dispatchEvent(new Event('input',{bubbles:true}));}`);
    await until(async () => (await equalizer.get()).settings.customGains[0] === 7, 'Manual edit not saved');
    await choosePreset('vocal');
    const saved = (await equalizer.get()).settings;
    equalizer.dispose();
    const restored = createEqualizer(player);
    assert.deepEqual((await restored.get()).settings, saved);
    assert.equal(saved.preset, 'vocal');
    assert.equal(saved.customGains[0], 7, 'Custom memory survives restart while a named preset is selected');
    await mini.popup.reload();
    await ui(`document.querySelector('#eq-button').click()`);
    await until(() => ui(`document.querySelector('#eq-preset')?.dataset.value === 'vocal'`), 'Saved preset not restored after card reload');
    await choosePreset('custom');
    assert.equal(Number(await ui(`document.querySelector('#eq-band-0').value`)), 7, 'Reopened UI recalls manual gains');
    await choosePreset('vocal');
    console.log('PASS: rock/custom switching, matching flat values, manual memory and restart persistence');
    await remote(`const old=document.querySelector('video');old.pause();const next=old.cloneNode(false);next.src=old.src;old.replaceWith(next);next.play()`);
    await delay(300);
    assert.ok(Number.isFinite((await remote('window.sample()')).low), 'Audio persists when media element is replaced');
    await player.webContents.reload(); await delay(300);
    await restored.get();
    await remote(`document.querySelector('video').play()`);
    assert.ok(Number.isFinite((await remote('window.sample()')).low), 'Saved EQ survives page reload');
    await mini.open();
    await delay(350);
    assert.equal(await ui(`document.querySelector('#eq-panel').scrollHeight > document.querySelector('#eq-panel').clientHeight`), false, 'Equalizer controls should fit the small card without scrolling: ' + await ui(`JSON.stringify([...document.querySelector('#eq-panel').children].map(e=>({c:e.className,h:e.getBoundingClientRect().height})).concat([{h:document.querySelector('#eq-panel').clientHeight,s:document.querySelector('#eq-panel').scrollHeight}]))`));
    fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../artifacts/equalizer.png'), (await mini.popup.webContents.capturePage()).toPNG());
    await ui(`document.querySelector('#eq-preset').click()`);
    await until(() => ui(`!!document.querySelector('#eq-preset-list')`), 'Dropdown missing for visual check');
    assert.equal(await ui(`document.querySelector('#eq-preset-list').getBoundingClientRect().bottom <= innerHeight`), true, 'Preset dropdown should fit within card');
    fs.writeFileSync(path.join(__dirname, '../artifacts/equalizer-dropdown.png'), (await mini.popup.webContents.capturePage()).toPNG());
    await ui(`document.querySelector('#expand').click()`);
    await until(() => ui(`!document.querySelector('#queue-panel').hidden && document.querySelector('#eq-panel').hidden`), 'Queue and EQ panels overlap');
    console.log('PASS: presets, persistence, replaced media, reload and queue/EQ panel switching');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});




