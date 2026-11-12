// SPDX-License-Identifier: GPL-3.0-only
const { app } = require('electron');
const { createPlayer } = require('../src/main.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const execFile = require('node:util').promisify(require('node:child_process').execFile);
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'ytmusic-live-')));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const { player, win, equalizer } = createPlayer();
  const js = source => player.webContents.executeJavaScript(source, true);
  try {
    await player.webContents.loadURL('https://music.youtube.com/watch?v=ObRKDMABsdY');
    await delay(4000);
    await js(`document.querySelector('video')?.play().catch(() => {})`);
    let state;
    for (let attempt = 0; attempt < 90; attempt++) {
      await delay(1000);
      state = await js(`({ paused: document.querySelector('video')?.paused, time: document.querySelector('video')?.currentTime, error: document.querySelector('video')?.error?.message, title: navigator.mediaSession.metadata?.title, ad: !!document.querySelector('.ad-showing') })`);
      if (state.time > 1 && state.paused === false && state.title && !state.ad) break;
    }
    assert.ok(state.time > 1 && state.paused === false, JSON.stringify(state));
    assert.equal(state.ad, false, 'Wait for advertisements to finish before checking song playback');
    const eq = await equalizer.set({ enabled: true, gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] });
    assert.equal(eq.status.state, 'active', 'EQ supports the real YouTube Music stream');
    const signal = await js(`(async()=>{
      const engine=window[Symbol.for('ytmusic-tray.equalizer')];
      const analyser=engine.context.createAnalyser();engine.output.connect(analyser);
      let rms=0;
      for(let i=0;i<8;i++){
        await new Promise(resolve=>setTimeout(resolve,200));
        const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);
        rms=Math.max(rms,Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length));
      }
      engine.output.disconnect(analyser);
      return {rms,context:engine.context.state};
    })()`);
    assert.equal(signal.context,'running');
    assert.ok(signal.rms>0.00001,'Real audio passes through EQ instead of becoming silent: '+JSON.stringify(signal));
    console.log('PASS: actual YouTube Music audio flows through enabled EQ');
    win.close();
    const before = state.time;
    await delay(2000);
    assert.ok(await js(`document.querySelector('video').currentTime`) > before, 'Live song continues hidden');
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'media-session.ps1'), '-ExpectedTitle', state.title];
    const inspect = JSON.parse((await execFile('powershell.exe', args, { windowsHide: true })).stdout.trim());
    assert.equal(inspect.status, 'Playing');
    await execFile('powershell.exe', [...args, '-Action', 'pause'], { windowsHide: true });
    await delay(500);
    assert.equal(await js(`document.querySelector('video').paused`), true);
    console.log('PASS: actual YouTube Music song plays hidden, Windows metadata and pause:', JSON.stringify(inspect));
    app.quit();
  } catch (error) { console.error(error); app.exit(1); }
});


