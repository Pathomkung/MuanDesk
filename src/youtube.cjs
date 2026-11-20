// SPDX-License-Identifier: GPL-3.0-only
// Runs in the website's main world. Keep this function self-contained.
function pageCommand(command) {
  if (command.type === 'seek' && location.origin !== 'https://music.youtube.com') return { status: 'stale' };
  const player = document.querySelector('#movie_player');
  const playerVideoId = player?.getVideoData?.()?.video_id;
  const videoId = playerVideoId || new URL(location.href).searchParams.get('v');
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
  const playerVideo = player?.querySelector('video.html5-main-video') || player?.querySelector('video')
    || document.querySelector('video.html5-main-video');
  const video = playerVideo || document.querySelector('video');
  const ad = !!document.querySelector('.ad-showing');
  const duration = Number.isFinite(video?.duration) ? video.duration : null;
  const time = video?.readyState >= 1 && Number.isFinite(video.currentTime) ? video.currentTime : null;
  const identityKey = Symbol.for('muandesk.playbackOccurrence');
  const occurrence = getOccurrence();
  const ranges = [];
  if (occurrence && !ad && video.readyState >= 1 && !video.error && duration > 0) {
    const seekable = video.seekable;
    for (let i = 0; i < seekable.length; i++) {
      const start = Math.max(0, seekable.start(i));
      const end = Math.min(duration, seekable.end(i));
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) ranges.push({ start, end });
    }
  }
  if (command.type === 'seek') {
    if (command.occurrence !== occurrence) return { status: 'stale' };
    if (!ranges.length) throw new Error('The current media is not seekable');
    const seconds = Math.min(ranges.at(-1).end, Math.max(ranges[0].start, command.seconds));
    let target = ranges[0].start;
    for (const { start, end } of ranges) {
      const candidate = Math.min(end, Math.max(start, seconds));
      if (Math.abs(candidate - seconds) < Math.abs(target - seconds)) target = candidate;
    }
    video.currentTime = target;
    const position = video.currentTime;
    if (!Number.isFinite(position) || Math.abs(position - target) > 0.05) throw new Error('The current media rejected the seek');
    return { status: 'ok', time: position };
  }
  const metadata = navigator.mediaSession?.metadata;
  const bar = document.querySelector('ytmusic-player-bar');
  return {
    title: metadata?.title || text(bar, '.title'),
    artist: metadata?.artist || text(bar, '.byline'),
    artwork: imageUrl(metadata?.artwork?.[0]?.src, bar?.querySelector('img.image')?.getAttribute('src')),
    paused: video?.paused ?? true,
    time,
    duration,
    ad,
    seek: ranges.length ? { occurrence, start: ranges[0].start, end: ranges.at(-1).end } : null,
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

  function getOccurrence() {
    if (!playerVideo || typeof playerVideoId !== 'string' || !playerVideoId || (currentIndex >= 0 && matchingCurrent < 0)) {
      delete document[identityKey];
      return null;
    }
    const selection = currentIndex >= 0 ? key(rows[currentIndex], currentIndex) : null;
    const previous = document[identityKey];
    const source = video.currentSrc;
    if (previous?.video === video && previous.source === source && previous.videoId === playerVideoId
      && previous.index === currentIndex && previous.selection === selection) return previous.token;
    const token = crypto.randomUUID();
    document[identityKey] = { video, source, videoId: playerVideoId, index: currentIndex, selection, token };
    return token;
  }
}

async function youtubeCommand(win, command = { type: 'snapshot' }) {
  if (!win.webContents.getURL().startsWith('https://music.youtube.com/')) {
    if (command.type === 'select') throw new Error('เปิด YouTube Music แล้วเลือกเพลงก่อน');
    if (command.type === 'seek') return { status: 'stale' };
    return { title: '', artist: '', artwork: '', paused: true, time: null, duration: null, ad: false, seek: null, queue: [] };
  }
  const result = await win.webContents.executeJavaScript(`(${pageCommand.toString()})(${JSON.stringify(command)})`, true);
  if (command.type === 'select' && result === false) throw new Error('รายการเพลงเปลี่ยนแล้ว กรุณาเลือกอีกครั้ง');
  return result;
}

module.exports = { youtubeCommand };


