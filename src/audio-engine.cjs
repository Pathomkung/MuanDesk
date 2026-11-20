// SPDX-License-Identifier: GPL-3.0-only
function applyAudioSettings(settings, frequencies) {
  const slot = Symbol.for('ytmusic-tray.equalizer');
  let engine = window[slot];
  if (!engine && !settings.enabled) return { state: 'off' };
  if (!engine) {
    const context = new AudioContext();
    const filters = frequencies.map(frequency => {
      const filter = context.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = Math.min(frequency, context.sampleRate * 0.49);
      filter.Q.value = 1.4;
      return filter;
    });
    const output = context.createGain();
    const limiterMakeupTrim = 10 ** (-0.484 / 20);
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    limiter.connect(output);
    filters.forEach((filter, index) => filter.connect(filters[index + 1] || output));
    output.connect(context.destination);
    const sources = new WeakMap();
    const active = new Map();
    engine = { context, filters, output, limiter, signature: '', enabled: false, state: 'waiting' };
    engine.attach = () => {
      for (const [media, source] of active) if (!media.isConnected) { source.disconnect(); active.delete(media); }
      let unsupported = false;
      for (const media of document.querySelectorAll('video, audio')) {
        if (active.has(media)) continue;
        const src = media.currentSrc || media.src;
        if (!src) continue;
        let safe = false;
        try { safe = new URL(src, location.href).origin === location.origin || !!media.crossOrigin; } catch {}
        if (!safe || media.mediaKeys) { unsupported = true; continue; }
        try {
          let source = sources.get(media);
          if (!source) { source = context.createMediaElementSource(media); sources.set(media, source); }
          source.connect(filters[0]); active.set(media, source);
        } catch { unsupported = true; }
      }
      engine.state = active.size ? 'active' : unsupported ? 'unsupported' : 'waiting';
    };
    engine.update = value => {
      const signature = JSON.stringify(value);
      if (signature !== engine.signature) {
        if (engine.enabled !== value.enabled) {
          filters.at(-1).disconnect();
          filters.at(-1).connect(value.enabled ? limiter : output);
          output.gain.value = value.enabled ? limiterMakeupTrim : 1;
        }
        engine.enabled = value.enabled;
        const gains = value.enabled ? value.gains : frequencies.map(() => 0);
        filters.forEach((filter, index) => {
          filter.gain.cancelScheduledValues(context.currentTime);
          filter.gain.setTargetAtTime(gains[index], context.currentTime, 0.015);
        });
        engine.signature = signature;
      }
      engine.attach();
    };
    let attachPending = false;
    new MutationObserver(() => {
      if (attachPending) return;
      attachPending = true;
      setTimeout(() => { attachPending = false; engine.attach(); }, 100);
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    document.addEventListener('play', () => { engine.attach(); context.resume().catch(() => {}); }, true);
    window[slot] = engine;
  }
  engine.update(settings);
  engine.context.resume().catch(() => {});
  return { state: settings.enabled ? engine.state : 'off' };
}

module.exports = { applyAudioSettings };


