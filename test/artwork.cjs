// SPDX-License-Identifier: GPL-3.0-only
const {app}=require('electron');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'ytmusic-artwork-')));
const {createPlayer}=require('../src/main.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const {player,win,mini}=createPlayer();
  const remote=source=>player.webContents.executeJavaScript(source,true);
  const js=source=>mini.popup.webContents.executeJavaScript(source,true);
  try {
    await player.webContents.loadURL('https://music.youtube.com/watch?v=ObRKDMABsdY&list=RDAMVMObRKDMABsdY');
    for(let i=0;i<30;i++) {if(await remote(`document.querySelectorAll('ytmusic-player-queue-item').length > 20`))break;await delay(500);}
    console.log('Lazy artwork diagnostic:',await remote(`JSON.stringify([...document.querySelectorAll('ytmusic-player-queue-item')].filter((_,i)=>[0,5,20,30].includes(i)).map(row=>({title:row.querySelector('.song-title')?.textContent,raw:row.querySelector('img')?.getAttribute('src'),resolved:row.querySelector('img')?.src,thumbnail:row.data?.thumbnail?.thumbnails?.[0]?.url})))`));
    win.hide();
    await mini.open();
    const snapshot=await js('window.mini.snapshot()');
    assert.ok(snapshot.queue.length>20);
    for(const item of snapshot.queue) {
      assert.ok(item.artwork.startsWith('https://') && new URL(item.artwork).hostname !== 'music.youtube.com',`Invalid artwork for ${item.title}: ${item.artwork}`);
    }
    await js(`document.querySelector('#expand').click()`);
    await delay(400);
    let visible;
    for(let i=0;i<40;i++) {
      await js(`document.querySelectorAll('.song')[20]?.scrollIntoView({block:'center'})`);
      await delay(100);
      visible=await js(`(()=>{const q=document.querySelector('#queue').getBoundingClientRect();return [...document.querySelectorAll('.song-cover')].filter(img=>{const r=img.getBoundingClientRect();return r.bottom>q.top&&r.top<q.bottom}).map(img=>({src:img.src,loaded:img.complete&&img.naturalWidth>0,hidden:img.hidden}))})()`);
      if(visible.length>0&&visible.every(img=>img.loaded&&!img.hidden)&&await js(`document.querySelector('#queue').scrollTop > 500`))break;
      await delay(250);
    }
    assert.ok(visible.length>0&&visible.every(img=>img.loaded&&!img.hidden),JSON.stringify(visible));
    assert.ok(await js(`document.querySelector('#queue').scrollTop > 500`),'Deep queue is visible');
    await delay(250);
    fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});
    fs.writeFileSync(path.join(__dirname,'../artifacts/queue-artwork.png'),(await mini.popup.webContents.capturePage()).toPNG());
    console.log('PASS: all queue URLs valid; deep queue artwork loads without scrolling the main player');
    app.exit(0);
  } catch(error){console.error(error);app.exit(1);}
});


