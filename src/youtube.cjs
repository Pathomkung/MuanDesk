// SPDX-License-Identifier: GPL-3.0-only
// Runs in the website's main world. Keep this function self-contained.
function pageCommand(command) {
  const videoId = document.querySelector('#movie_player')?.getVideoData?.()?.video_id || new URL(location.href).searchParams.get('v');
  function isQueueItemShown(row, root) {
    for (let node = row; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || style.display === 'none') return false;
      if (node === root) return true;
    }
    return false;
  }
  const queues = [...document.querySelectorAll('ytmusic-player-queue')].map(root => ({
    root,
    rows: [...root.querySelectorAll('ytmusic-player-queue-item')]
      .filter(row => row.closest('ytmusic-player-queue') === root && isQueueItemShown(row, root)),
  })).filter(queue => queue.rows.length);
  const visibleQueues = queues.filter(queue => queue.root.getClientRects().length > 0);
  const candidates = visibleQueues.length ? visibleQueues : queues;
  const activeQueue = candidates.find(queue => queue.rows.some(row => row.hasAttribute('selected') && row.data?.videoId === videoId))
    || candidates.find(queue => queue.rows.some(row => row.hasAttribute('selected')))
    || candidates[0];
  const rows = activeQueue?.rows || [];
  const matchingCurrent = rows.findIndex(row => row.hasAttribute('selected') && row.data?.videoId === videoId);
  const currentIndex = matchingCurrent < 0 ? rows.findIndex(row => row.hasAttribute('selected')) : matchingCurrent;
  const text = (element, selector) => element?.querySelector(selector)?.textContent?.trim() || '';
  const imageUrl = (...candidates) => candidates.find(url => typeof url === 'string' && url.startsWith('https://')) || '';
  const key = (row, index) => row.data?.playlistSetVideoId || `${row.data?.videoId || text(row, '.song-title')}:${index}`;
  if (command.type === 'select') {
    const row = rows.find((item, index) => key(item, index) === command.key);
    const button = row?.querySelector('ytmusic-play-button-renderer');
    if (!button || row.hasAttribute('unplayable')) return false;
    button.click();
    return true;
  }
  const metadata = navigator.mediaSession?.metadata;
  const video = document.querySelector('video');
  const bar = document.querySelector('ytmusic-player-bar');
  return {
    title: metadata?.title || text(bar, '.title'),
    artist: metadata?.artist || text(bar, '.byline'),
    artwork: imageUrl(metadata?.artwork?.[0]?.src, bar?.querySelector('img.image')?.getAttribute('src')),
    paused: video?.paused ?? true,
    time: video?.currentTime || 0,
    duration: Number.isFinite(video?.duration) ? video.duration : 0,
    ad: !!document.querySelector('.ad-showing'),
    queue: rows.map((row, index) => ({
      key: key(row, index), videoId: row.data?.videoId || '', title: text(row, '.song-title'),
      artist: text(row, '.byline'), duration: text(row, '.duration'),
      artwork: imageUrl(
        row.data?.thumbnail?.thumbnails?.find(image => image.width >= 120)?.url,
        row.data?.thumbnail?.thumbnails?.[0]?.url,
        row.querySelector('img')?.getAttribute('src'),
      ),
      current: index === currentIndex, disabled: row.hasAttribute('unplayable'),
    })).filter(item => item.title),
  };
}

async function youtubeCommand(win, command = { type: 'snapshot' }) {
  if (!win.webContents.getURL().startsWith('https://music.youtube.com/')) {
    if (command.type === 'select') throw new Error('เปิด YouTube Music แล้วเลือกเพลงก่อน');
    return { title: '', artist: '', artwork: '', paused: true, time: 0, duration: 0, ad: false, queue: [] };
  }
  const result = await win.webContents.executeJavaScript(`(${pageCommand.toString()})(${JSON.stringify(command)})`, true);
  if (command.type === 'select' && result === false) throw new Error('รายการเพลงเปลี่ยนแล้ว กรุณาเลือกอีกครั้ง');
  return result;
}

module.exports = { youtubeCommand };


