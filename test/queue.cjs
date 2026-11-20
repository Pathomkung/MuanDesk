// SPDX-License-Identifier: GPL-3.0-only
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'muandesk-queue-')));
const {createMiniPlayer}=require('../src/mini-player.cjs');
const {createLanguage}=require('../src/language.cjs');
const {youtubeCommand}=require('../src/youtube.cjs');
const html=`<!doctype html><style>ytmusic-player-queue,ytmusic-player-queue-item{display:block}[hidden]{display:none!important}</style>
<ytmusic-player-bar><span class="title">Current song</span></ytmusic-player-bar>
<div id="page">
<ytmusic-player-queue id="inactive" hidden>
 <ytmusic-player-queue-item selected><span class="song-title">Old hidden queue</span></ytmusic-player-queue-item>
</ytmusic-player-queue>
<ytmusic-player-queue id="active">
 <div><ytmusic-player-queue-item selected data-id="current"><span class="song-title">Current song</span><ytmusic-play-button-renderer></ytmusic-play-button-renderer></ytmusic-player-queue-item></div>
 <div hidden><ytmusic-player-queue-item selected data-id="alternate"><span class="song-title">Current song video version</span><ytmusic-play-button-renderer></ytmusic-play-button-renderer></ytmusic-player-queue-item></div>
 <div><ytmusic-player-queue-item data-id="next"><span class="song-title">Next song</span><ytmusic-play-button-renderer></ytmusic-play-button-renderer></ytmusic-player-queue-item></div>
 <div style="display:none"><ytmusic-player-queue-item data-id="next-alternate"><span class="song-title">Next song video version</span><ytmusic-play-button-renderer></ytmusic-play-button-renderer></ytmusic-player-queue-item></div>
 <div><ytmusic-player-queue-item data-id="repeat"><span class="song-title">Current song</span><ytmusic-play-button-renderer></ytmusic-play-button-renderer></ytmusic-player-queue-item></div>
</ytmusic-player-queue></div>
<script>
window.clicked=[];
for(const row of document.querySelectorAll('[data-id]')){
 row.data={playlistSetVideoId:row.dataset.id,videoId:row.dataset.id==='repeat'?'current':row.dataset.id};
 row.querySelector('ytmusic-play-button-renderer').onclick=()=>window.clicked.push(row.dataset.id);
}
</script>`;

async function testQueueAdvance(win) {
  const remote = source => win.webContents.executeJavaScript(source);
  await remote(`
    document.querySelector('[data-id="repeat"]').data.playlistSetVideoId = 'current';
    document.querySelector('#page').hidden = false;
    document.querySelector('#page').style.visibility = 'visible';
  `);
  const language = createLanguage(win);
  const tray = Object.assign(new EventEmitter(), {getBounds: () => win.getBounds()});
  const {popup} = createMiniPlayer(win, tray, null, () => win.show(), null, language);
  popup.webContents.setBackgroundThrottling(false);
  const card = source => popup.webContents.executeJavaScript(source);
  async function waitFor(check, message) {
    for (let i = 0; i < 50; i++) {
      if (await card(check)) return;
      await delay(100);
    }
    throw Error(message);
  }
  const rows = () => card(`Array.from(document.querySelectorAll('#queue .song'), row => [
    row.querySelector('.song-title').textContent,
    row.getAttribute('aria-current'),
    row.querySelector('.song-artist').textContent,
  ])`);
  await waitFor(`document.querySelector('#title')?.textContent === 'Current song'`, 'Initial song did not load');
  await card(`document.querySelector('#expand').click()`);
  await waitFor(`document.querySelector('#queue-panel').getBoundingClientRect().height > 0`, 'Up next did not open');
  const playing = language.t('nowPlaying') + ' • ';
  assert.deepEqual(await rows(), [['Current song', 'true', playing], ['Next song', 'false', ''], ['Current song', 'false', '']]);
  await remote(`
    document.querySelector('[data-id="current"]').removeAttribute('selected');
    document.querySelector('[data-id="next"]').setAttribute('selected', '');
    history.replaceState(null, '', '?v=next');
    document.querySelector('ytmusic-player-bar .title').textContent = 'Next song';
  `);
  await waitFor(`document.querySelector('#title')?.textContent === 'Next song'`, 'Mini player did not refresh to Next song');
  assert.deepEqual(await rows(), [['Next song', 'true', playing], ['Current song', 'false', '']]);
  console.log('PASS: mini player removes the played occurrence, marks only the new current song and keeps the later repeat');
}

app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,webPreferences:{partition:'queue-fixture',sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 try{
  await win.webContents.session.protocol.handle('https',()=>new Response(html,{headers:{'content-type':'text/html'}}));
  await win.loadURL('https://music.youtube.com/watch?v=current');
  const snapshot=await youtubeCommand(win);
  assert.deepEqual(snapshot.queue.map(item=>item.title),['Current song','Next song','Current song']);
  assert.deepEqual(snapshot.queue.map(item=>item.current),[true,false,false]);
  assert.equal(await youtubeCommand(win,{type:'select',key:'next'}),true);
  assert.deepEqual(await win.webContents.executeJavaScript('window.clicked'),['next']);
  await assert.rejects(()=>youtubeCommand(win,{type:'select',key:'alternate'}));
  await win.webContents.executeJavaScript(`document.querySelector('#page').style.visibility='hidden'`);
  assert.deepEqual((await youtubeCommand(win)).queue.map(item=>item.key),['current','next','repeat'],'Closing the player panel must not erase its queue through inherited visibility');
  assert.equal(await youtubeCommand(win,{type:'select',key:'next'}),true,'Queue selection works with the player panel hidden');
  await win.webContents.executeJavaScript(`document.querySelector('#page').hidden=true`);
  assert.deepEqual((await youtubeCommand(win)).queue.map(item=>item.key),['current','next','repeat']);
  console.log('PASS: active queue only, hidden audio/video variants excluded, repeated songs preserved, selection targets correct row, queue survives closed player page');
  await testQueueAdvance(win);
  app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
});

