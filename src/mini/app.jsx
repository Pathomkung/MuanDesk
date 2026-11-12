// SPDX-License-Identifier: GPL-3.0-only
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { translate, translateError } from '../i18n.cjs';

const LanguageContext = createContext(null);
function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('th');
  useEffect(() => {
    let revision = 0;
    const unsubscribe = window.appLanguage.onChange(value => { revision++; setLocale(value); });
    window.appLanguage.get().then(value => { if (!revision) setLocale(value); }).catch(console.error);
    return unsubscribe;
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <LanguageContext.Provider value={{ locale, t: (key, values) => translate(locale, key, values) }}>{children}</LanguageContext.Provider>;
}

const paths = {
  eq: 'M5 3v5m0 4v9M12 3v10m0 4v4M19 3v2m0 4v12M2 8h6m1 9h6m1-12h6',
  open: 'M14 4h6v6M20 4l-9 9M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5',
  close: 'm6 6 12 12M18 6 6 18', chevron: 'm6 9 6 6 6-6', check: 'm5 12 4 4L19 6', reset: 'M4 4v6h6M4 10a8 8 0 1 1 1 8',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  previous: 'M5 5h2v14H5zM19 5v14L8 12z', next: 'M17 5h2v14h-2zM5 5v14l11-7z',
  play: 'M8 5v14l11-7z', pause: 'M7 5h4v14H7zM14 5h4v14h-4z', music: 'M9 4v11.2a4 4 0 1 0 2 3.5V8l8-2v7.2a4 4 0 1 0 2 3.5V1z',
};
const solid = new Set(['previous', 'next', 'play', 'pause', 'music']);
function Icon({ name, ...props }) { return <svg viewBox="0 0 24 24" className={solid.has(name) ? 'solid' : 'outline'} aria-hidden="true" {...props}><path d={paths[name]}/></svg>; }
function IconButton({ name, label, ...props }) { return <button className="icon" aria-label={label} title={label} {...props}><Icon name={name}/></button>; }
function Cover({ url, className }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return <span className={`cover ${className || ''}`}><Icon name="music"/>{!failed && url?.startsWith('https:') && <img src={url} alt="" onError={() => setFailed(true)}/>}</span>;
}
const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function PresetDropdown({ value, presets, onChange, visible }) {
  const { t } = useContext(LanguageContext);
  const options = [{ id: 'custom' }, ...presets].map(item => ({ ...item, label: t(item.id) }));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef(null), trigger = useRef(null);
  const selected = options.findIndex(option => option.id === value);
  useEffect(() => {
    const dismiss = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const hide = () => { if (document.hidden) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('visibilitychange', hide); };
  }, []);
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);
  function choose(index) { onChange(options[index].id); setOpen(false); trigger.current?.focus(); }
  function keyboard(event) {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const start = open ? active : selected;
      setActive(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (start + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
      setOpen(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active); else { setActive(selected); setOpen(true); }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    } else if (event.key === 'Tab') setOpen(false);
  }
  return <div className="preset-field" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label id="eq-preset-label" htmlFor="eq-preset">{t('presets')}</label>
    <button id="eq-preset" className="preset-trigger" ref={trigger} type="button" role="combobox" aria-labelledby="eq-preset-label eq-preset-value" aria-haspopup="listbox" aria-controls="eq-preset-list" aria-expanded={open} aria-activedescendant={open ? `eq-option-${options[active].id}` : undefined} data-value={value} onKeyDown={keyboard} onClick={() => { setActive(selected); setOpen(!open); }}>
      <span id="eq-preset-value">{options[selected]?.label}</span><Icon name="chevron"/>
    </button>
    {open && <div id="eq-preset-list" className="preset-menu" role="listbox" aria-labelledby="eq-preset-label">{options.map((option, index) => <div key={option.id} id={`eq-option-${option.id}`} role="option" aria-selected={value === option.id} className={`preset-option ${active === index ? 'highlighted' : ''}`} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
      <span>{option.label}</span>{value === option.id && <Icon name="check"/>}
    </div>)}</div>}
  </div>;
}
function Equalizer({ data, update, visible }) {
  const { t } = useContext(LanguageContext);
  const { settings, frequencies, presets } = data;
  const changeBand = (index, gain) => {
    const gains = [...settings.gains]; gains[index] = gain;
    update({ ...settings, preset: 'custom', gains, customGains: [...gains] });
  };
  return <>
    <div className="eq-heading"><div><h2>Equalizer <span>{t('bandCount')}</span></h2></div>
      <label className="eq-switch" title={t('enableEq')}><input id="eq-enabled" aria-label={t('enableEq')} type="checkbox" role="switch" checked={settings.enabled} onChange={e => update({ ...settings, enabled: e.target.checked })}/><span className="switch-track"/></label>
    </div>
    <div className="eq-options"><PresetDropdown value={settings.preset} presets={presets} visible={visible} onChange={preset => {
      update({ ...settings, preset, gains: [...(preset === 'custom' ? settings.customGains : presets.find(item => item.id === preset).gains)] });
    }}/>
      <IconButton id="eq-reset" name="reset" label={t('resetEq')} onClick={() => { const gains = frequencies.map(() => 0); update({ ...settings, preset: 'custom', gains, customGains: [...gains] }); }}/>
    </div>
    <div className={`equalizer-chart ${settings.enabled ? '' : 'bypassed'}`}>
      <div className="gain-scale"><span>+12</span><span>0</span><span>−12</span></div><div className="chart-grid" aria-hidden="true"><i/><i/><i/></div>
      <div id="eq-bands" aria-label={t('bands')}>{frequencies.map((frequency, index) => {
        const gain = settings.gains[index];
        return <div className="eq-band" key={frequency}><output htmlFor={`eq-band-${index}`}>{gain > 0 ? '+' : ''}{gain}</output>
          <input id={`eq-band-${index}`} type="range" min="-12" max="12" step="1" value={gain} aria-label={`${frequency} Hz`} aria-valuetext={`${gain} dB`} onInput={e => changeBand(index, Number(e.currentTarget.value))} onDoubleClick={() => changeBand(index, 0)}/>
          <label htmlFor={`eq-band-${index}`}>{frequency >= 1000 ? `${frequency / 1000}k` : frequency}</label></div>;
      })}</div>
    </div>
    <div className="eq-frequency-key"><span>{t('bassRange')}</span><span>{t('midRange')}</span><span>{t('trebleRange')}</span></div>
  </>;
}
function App() {
  const { t, locale } = useContext(LanguageContext);
  const [state, setState] = useState({ title: '', artist: '', queue: [], paused: true, time: 0, duration: 0 });
  const [panel, setPanel] = useState(null), panelRef = useRef(null);
  const [eq, setEq] = useState(null), [error, setError] = useState('');
  const pending = useRef(null), saving = useRef(false), timer = useRef(null), revision = useRef(0);
  function showError(error) { setError(error.message || t('connectionError')); }
  async function run(action) { try { await action(); } catch (error) { showError(error); } }
  useEffect(() => { if (!error) return; const timeout = setTimeout(() => setError(''), 4500); return () => clearTimeout(timeout); }, [error]);
  useEffect(() => {
    let disposed = false, refreshing = false;
    async function refresh() {
      if (disposed || refreshing || document.hidden) return;
      refreshing = true;
      try {
        const next = await window.mini.snapshot(); if (!disposed) setState(next);
        if (panelRef.current === 'eq' && !pending.current && !saving.current) {
          const current = revision.current, data = await window.mini.equalizer();
          if (!disposed && current === revision.current) setEq(data);
        }
      } catch (error) { if (!disposed) showError(error); }
      finally { refreshing = false; }
    }
    function keydown(event) { if (event.key === 'Escape' && !event.defaultPrevented) run(() => window.mini.hide()); }
    document.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', refresh); window.mini.onRefresh(refresh);
    const interval = setInterval(refresh, 1000); refresh();
    return () => { disposed = true; clearInterval(interval); document.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  async function showPanel(next) {
    const value = panelRef.current === next ? null : next;
    panelRef.current = value; setPanel(value); await window.mini.expand(value !== null);
    if (value === 'eq' && !saving.current && !pending.current) {
      const current = revision.current, data = await window.mini.equalizer();
      if (current === revision.current) setEq(data);
    }
  }
  async function save() {
    if (saving.current) return;
    saving.current = true;
    try {
      while (pending.current) {
        const settings = pending.current; pending.current = null;
        const current = revision.current, result = await window.mini.setEqualizer(settings);
        if (current === revision.current) setEq(result);
      }
    } catch (error) { showError(error); }
    finally { saving.current = false; }
  }
  function update(settings) {
    revision.current++; pending.current = settings;
    flushSync(() => setEq(previous => ({ ...previous, settings })));
    clearTimeout(timer.current); timer.current = setTimeout(save, 80);
  }
  const current = state.queue.findIndex(item => item.current), queue = state.queue.slice(current < 0 ? 0 : current);
  return <main>
    <header><span className="brand"><img src="../../assets/icon.png" alt=""/>MuanDesk</span><div>
      <IconButton id="eq-button" name="eq" label={t('openEq')} aria-expanded={panel === 'eq'} aria-controls="eq-panel" onClick={() => run(() => showPanel('eq'))}/>
      <IconButton id="open" name="open" label={t('openPlayer')} onClick={() => run(() => window.mini.show())}/><IconButton id="close" name="close" label={t('hideCard')} onClick={() => run(() => window.mini.hide())}/>
    </div></header>
    <section className="now" aria-label={t('nowPlaying')}><Cover url={state.artwork}/><div className="info"><h1 id="title" title={state.title}>{state.title || t('chooseSong')}</h1><p id="artist">{state.artist || t('chooseInPlayer')}</p><span id="ad" hidden={!state.ad}>{t('ad')}</span></div></section>
    <div className="transport"><IconButton id="previous" name="previous" label={t('previous')} disabled={!state.title} onClick={() => run(() => window.mini.media('previous'))}/><button id="toggle" className="play" aria-label={state.paused ? t('play') : t('pause')} disabled={!state.title} onClick={() => run(() => window.mini.media('toggle'))}><Icon name={state.paused ? 'play' : 'pause'}/></button><IconButton id="next" name="next" label={t('next')} disabled={!state.title} onClick={() => run(() => window.mini.media('next'))}/></div>
    <div className="timeline"><span id="time">{time(state.time)}</span><progress id="progress" value={state.time} max={state.duration || 1} aria-label={t('progress')}/><span id="duration">{time(state.duration)}</span></div>
    <button id="expand" aria-expanded={panel === 'queue'} aria-controls="queue-panel" onClick={() => run(() => showPanel('queue'))}><span>{t('upNext')} <span id="count" className="muted">{queue.length ? t('songs', { count: queue.filter(item => !item.current).length }) : ''}</span></span><Icon id="chevron" name="chevron"/></button>
    <section id="queue-panel" hidden={panel !== 'queue'} aria-label={t('queue')}><p className="queue-hint">{t('chooseToPlay')}</p><div id="queue" role="group" aria-label={t('songList')}>{queue.map(item => <button key={item.key} className="song" aria-current={item.current} data-key={item.key} disabled={item.disabled} title={`${item.title} • ${item.artist}`} onClick={() => run(() => window.mini.select(item.key))}><Cover url={item.artwork} className="song-cover"/><span className="song-text"><span className="song-title">{item.title}</span><span className="song-artist">{item.current ? t('nowPlaying') + ' • ' : ''}{item.artist}</span></span><span className="song-duration">{item.duration}</span></button>)}</div><p id="empty" className="empty" hidden={queue.length > 0}>{t('emptyQueue')}</p></section>
    <section id="eq-panel" hidden={panel !== 'eq'} aria-label="Equalizer">{eq && <Equalizer data={eq} update={update} visible={panel === 'eq'}/>}</section><p id="error" role="status" hidden={!error}>{translateError(locale, error)}</p>
  </main>;
}
function EqualizerWindow() {
  const { locale } = useContext(LanguageContext);
  const [data, setData] = useState(null), [error, setError] = useState('');
  const pending = useRef(null), saving = useRef(false), timer = useRef(null), revision = useRef(0);
  useEffect(() => {
    let disposed = false, polling = false;
    async function refresh() {
      if (disposed || polling || pending.current || saving.current || document.hidden) return;
      polling = true;
      const current = revision.current;
      try { const value = await window.equalizerWindow.get(); if (!disposed && current === revision.current) setData(value); }
      catch (error) { if (!disposed) setError(error.message); }
      finally { polling = false; }
    }
    const interval = setInterval(refresh, 500);
    document.addEventListener('visibilitychange', refresh); refresh();
    return () => { disposed = true; clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  async function save() {
    if (saving.current) return;
    saving.current = true;
    try {
      while (pending.current) {
        const settings = pending.current; pending.current = null;
        const current = revision.current, result = await window.equalizerWindow.set(settings);
        if (current === revision.current) setData(result);
      }
      setError('');
    } catch (error) { setError(error.message); }
    finally { saving.current = false; }
  }
  function update(settings) {
    revision.current++; pending.current = settings;
    flushSync(() => setData(previous => ({ ...previous, settings })));
    clearTimeout(timer.current); timer.current = setTimeout(save, 80);
  }
  return <main className="equalizer-window"><section id="eq-panel" aria-label="Equalizer">{data && <Equalizer data={data} update={update} visible/>}</section><p id="error" role="status" hidden={!error}>{translateError(locale, error)}</p></main>;
}

function Titlebar() {
  const { t, locale } = useContext(LanguageContext);
  const [open, setOpen] = useState(false), [error, setError] = useState('');
  useEffect(() => window.titlebar.onMenuClosed(() => setOpen(false)), []);
  return <header><span><img src="../../assets/icon.png" alt=""/>MuanDesk</span><div className="title-actions">
    <button id="language-button" title={error || t('language')} aria-label={t('language')} aria-haspopup="listbox" aria-expanded={open} onClick={() => window.titlebar.openLanguages().then(setOpen).catch(error => setError(error.message))}><Icon name="globe"/><span>{locale === 'th' ? 'ไทย' : 'English'}</span><Icon name="chevron"/></button>
    <IconButton id="open-equalizer" name="eq" label={t('openEq')} onClick={() => window.titlebar.openEqualizer().catch(error => setError(error.message))}/>
  </div></header>;
}
function LanguageMenu() {
  const { t, locale } = useContext(LanguageContext);
  const options = [{ id: 'th', label: 'ภาษาไทย' }, { id: 'en', label: 'English' }];
  const [active, setActive] = useState(0), [error, setError] = useState('');
  const list = useRef(null);
  useEffect(() => { setActive(locale === 'en' ? 1 : 0); }, [locale]);
  useEffect(() => {
    const focus = () => { if (!document.hidden) list.current?.focus(); };
    document.addEventListener('visibilitychange', focus); window.addEventListener('focus', focus); focus();
    return () => { document.removeEventListener('visibilitychange', focus); window.removeEventListener('focus', focus); };
  }, []);
  const choose = index => window.appLanguage.set(options[index].id).catch(error => setError(error.message));
  return <div ref={list} className="language-menu" role="listbox" tabIndex={0} aria-label={t('language')} aria-activedescendant={`language-${options[active].id}`} onKeyDown={event => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - active); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); window.appLanguage.close().catch(console.error); }
  }}>{options.map((option, index) => <div id={`language-${option.id}`} key={option.id} role="option" aria-selected={locale === option.id} className={`language-option ${active === index ? 'highlighted' : ''}`} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}><span>{option.label}</span>{locale === option.id && <Icon name="check"/>}</div>)}{error && <span role="alert">{error}</span>}</div>;
}
const surfaces = { equalizer: EqualizerWindow, titlebar: Titlebar, language: LanguageMenu };
const Surface = surfaces[document.body.dataset.window] || App;
createRoot(document.getElementById('root')).render(<LanguageProvider><Surface/></LanguageProvider>);




