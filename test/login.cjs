// SPDX-License-Identifier: GPL-3.0-only
const {app,shell}=require('electron');
shell.openExternal=async value=>{const url=new URL(value);console.log('External navigation:',url.origin+url.pathname);};
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'ytmusic-login-')));
const {createPlayer}=require('../src/main.cjs');
const {isAppUrl}=require('../src/navigation.cjs');
app.whenReady().then(async()=>{
  const {player}=createPlayer();
  const blocked=[];
  player.webContents.on('will-navigate',(_event,value)=>{const url=new URL(value);console.log('Login navigation:',url.origin+url.pathname,'allowed:',isAppUrl(value));});
  player.webContents.on('will-redirect',(_event,value)=>{
    const url=new URL(value);
    console.log('Login redirect:',url.origin+url.pathname,'allowed:',isAppUrl(value));
    if(!isAppUrl(value))blocked.push(url.origin+url.pathname);
  });
  try {
    await player.webContents.loadURL('https://music.youtube.com/');
    const link=await player.webContents.executeJavaScript(`document.querySelector('a[href*="accounts.google.com/ServiceLogin"]')?.href`);
    assert.ok(link,'Google sign-in link exists');
    assert.equal(isAppUrl(new URL(link).searchParams.get('continue')),true,'YouTube login callback is permitted');
    assert.equal(isAppUrl('https://accounts.youtube.com/accounts/SetSID'),true,'Google can establish the YouTube sign-in session');
    assert.equal(isAppUrl('https://www.youtube.com/signin_prompt'),true,'YouTube can display its sign-in prompt');
    assert.equal(isAppUrl('https://myaccount.google.com/verification/selfie/precollection'),true,'Google can continue account verification after password submission');
    assert.equal(isAppUrl('https://myaccount.google.com.evil.example/verification/selfie/precollection'),false,'Verification lookalike domains stay blocked');
    assert.equal(isAppUrl('http://myaccount.google.com/verification/selfie/precollection'),false,'Verification requires HTTPS');
    assert.equal(isAppUrl('https://accounts.youtube.com.evil.example/accounts/SetSID'),false,'Account lookalike domains stay blocked');
    assert.equal(isAppUrl('https://www.youtube.com/watch?v=test'),false,'Regular YouTube videos open outside app');
    assert.equal(isAppUrl('https://www.youtube.com.evil.example/signin'),false,'Lookalike domains stay blocked');
    await player.webContents.executeJavaScript(`document.querySelector('a[href*="accounts.google.com/ServiceLogin"]').click()`,true);
    for(let i=0;i<30;i++) {
      if(await player.webContents.executeJavaScript(`!!document.querySelector('#identifierId')`))break;
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    console.log('Login page:',await player.webContents.executeJavaScript(`JSON.stringify({origin:location.origin,path:location.pathname,title:document.title,hasAccountField:!!document.querySelector('#identifierId'),text:document.body.innerText.slice(0,400)})`));
    assert.deepEqual(blocked,[],'App must not block Google login redirects');
    assert.equal(new URL(player.webContents.getURL()).hostname,'accounts.google.com','Clicking Sign in opens Google account entry');
    assert.equal(await player.webContents.executeJavaScript(`!!document.querySelector('#identifierId')`),true,'Google account field is displayed');
    console.log('PASS: Google login route is not blocked by app navigation policy');
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});



