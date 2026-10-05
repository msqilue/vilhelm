/* ===== SR/MR/R 事件语音卡详情页逻辑 ===== */
/* 版式：双（多）语音并列卡片式；卡面完整显示；台词随语音滚动高亮（当前句白色半透明全宽高亮） */
/* 与 SSS/SSR 事件页（event.html + event.js）分流：本页承接标签含 SR(t27)/MR(t28)/R(t29) 的事件 */

/* 稀有度判断：含 SR/MR/R 任意标签即走语音卡版式 */
function isVoiceEvent(ev) {
  return (ev.tags || []).some(t => ['t27', 't28', 't29'].includes(t));
}

initPage('timeline.html').then(() => {
  const id = new URLSearchParams(location.search).get('id');
  const ev = DATA.events.find(e => e.id === id);

  if (!ev) {
    document.getElementById('v-title').textContent = '未找到该事件';
    document.getElementById('v-voices').innerHTML =
      '<div class="v-empty">未找到该事件（id: ' + escapeHtml(id || '空') + '）。它可能已被删除。</div>';
    return;
  }

  /* 若该事件不是 SR/MR/R（误入本页），引导回标准事件页 */
  if (!isVoiceEvent(ev)) {
    location.replace('event.html' + location.search);
    return;
  }

  document.title = ev.title + ' · 莫弈·Vilhelm';
  renderHead(ev);
  renderVoices(ev);
  renderNav(ev);
});

function renderHead(ev) {
  const tags = eventTags(ev);
  document.getElementById('v-title').textContent = ev.title;
  document.getElementById('v-tags').innerHTML = tags.map(t => {
    const rare = ['t27', 't28', 't29'].includes(t.id);
    const color = t.color || '#8F8F9C';
    return `<span class="v-chip${rare ? ' rare' : ''}" style="border-color:${color};color:${color}">${escapeHtml(t.name)}</span>`;
  }).join('');
  const sub = [ev.date, ev.stage].filter(Boolean).join(' · ');
  const subEl = document.getElementById('v-sub');
  if (sub) { subEl.textContent = sub; subEl.style.display = ''; }
  else subEl.style.display = 'none';
}

function renderVoices(ev) {
  const box = document.getElementById('v-voices');
  const voices = ev.voices || [];
  if (!voices.length) {
    box.innerHTML = '<div class="v-empty">该事件暂无语音卡数据。</div>';
    return;
  }
  box.innerHTML = voices.map((v, i) => `
    <div class="v-card" id="vc${i}">
      <div class="v-bg"><img src="${escapeHtml(v.image)}" alt="${escapeHtml(v.title)}"></div>
      <div class="v-overlay"></div>
      <div class="v-top"><span class="v-name">${escapeHtml(v.title)}<span class="v-wave" id="vwave${i}"><i></i><i></i><i></i></span></span></div>
      <div class="v-lyrics" id="vlyr${i}"></div>
      <div class="v-player">
        <span class="v-time" id="vtime${i}">0:00 / 0:00</span>
        <div class="v-prow">
          <button class="v-btn" type="button" id="vpb${i}">▶</button>
          <div class="v-track" id="vtrk${i}"><div class="fill" id="vfill${i}"></div><div class="knob" id="vknb${i}"></div></div>
        </div>
      </div>
    </div>`).join('');
  voices.forEach((v, i) => makeVoicePlayer(v, i));
}

function fmtTime(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function makeVoicePlayer(voice, i) {
  const audio = new Audio(voice.audio);
  const pb = document.getElementById('vpb' + i);
  const track = document.getElementById('vtrk' + i);
  const fill = document.getElementById('vfill' + i);
  const knob = document.getElementById('vknb' + i);
  const timeEl = document.getElementById('vtime' + i);
  const lyrics = document.getElementById('vlyr' + i);
  const wave = document.getElementById('vwave' + i);
  const subs = voice.subs || [];

  /* 渲染台词 */
  const lines = [];
  subs.forEach(s => {
    const d = document.createElement('div');
    d.className = 'v-line'; d.textContent = s[2];
    lyrics.appendChild(d); lines.push(d);
  });

  pb.addEventListener('click', () => { audio.paused ? audio.play() : audio.pause(); });
  audio.addEventListener('play', () => { pb.textContent = '❚❚'; if (wave) wave.classList.add('on'); });
  audio.addEventListener('pause', () => { pb.textContent = '▶'; if (wave) wave.classList.remove('on'); });
  audio.addEventListener('ended', () => { pb.textContent = '▶'; if (wave) wave.classList.remove('on'); });

  function setProg() {
    const p = audio.duration ? audio.currentTime / audio.duration : 0;
    fill.style.width = (p * 100) + '%'; knob.style.left = (p * 100) + '%';
    timeEl.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration || (subs.length ? subs[subs.length - 1][1] : 0));
  }
  audio.addEventListener('timeupdate', setProg);
  audio.addEventListener('loadedmetadata', setProg);

  let seeking = false;
  function seekAt(cx) {
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (cx - r.left) / r.width));
    if (audio.duration) audio.currentTime = p * audio.duration;
    setProg();
  }
  track.addEventListener('mousedown', e => { seeking = true; seekAt(e.clientX); });
  document.addEventListener('mousemove', e => { if (seeking) seekAt(e.clientX); });
  document.addEventListener('mouseup', () => { seeking = false; });

  /* 台词自动滚动：当前句高亮（白色半透明全宽）+ 贴窗口顶部；
     句间空档与暂停时保持当前句高亮不消失，下一句出现才切换 */
  let curIdx = -1;
  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime;
    let idx = -1;
    for (let k = 0; k < subs.length; k++) if (t >= subs[k][0] && t < subs[k][1]) { idx = k; break; }
    if (idx >= 0) {
      if (idx === curIdx) return;
      curIdx = idx;
      lines.forEach((el, k) => {
        el.classList.toggle('active', k === idx);
        el.classList.toggle('done', k < idx);
      });
      lyrics.scrollTo({ top: Math.max(0, lines[idx].offsetTop - (lyrics.clientHeight - lines[idx].offsetHeight) / 2), behavior: 'smooth' });
    } else if (t < 0.5) { curIdx = -1; }
  });
}

/* 上一条 / 下一条：与事件页一致，按当前筛选（时间线 + 标签）顺序导航；voice 事件跳本页 */
function navScope(ev) {
  const params = new URLSearchParams(location.search);
  const navTl = params.get('tl');
  const navTags = (params.get('tags') || '').split(',').filter(Boolean);
  let list = DATA.events.filter(e => e.timelineId === ev.timelineId);
  if (navTl && navTl !== 'all' && navTl !== ev.timelineId) list = [];
  if (navTags.length) {
    list = list.filter(e => {
      for (const c of DATA.categories) {
        const selected = navTags.filter(tid => (c.tags || []).some(t => t.id === tid));
        if (selected.length && !selected.some(tid => (e.tags || []).includes(tid))) return false;
      }
      return true;
    });
  }
  return { ordered: sortEvents(list), navTl, navTags };
}

function renderNav(ev) {
  const el = document.getElementById('v-nav');
  const { ordered, navTl, navTags } = navScope(ev);
  const idx = ordered.findIndex(e => e.id === ev.id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = (idx >= 0 && idx + 1 < ordered.length) ? ordered[idx + 1] : null;

  const navHref = (e) => {
    const page = isVoiceEvent(e) ? 'event-voice.html' : 'event.html';
    let url = page + '?id=' + encodeURIComponent(e.id);
    if (navTl && navTl !== 'all') url += '&tl=' + encodeURIComponent(navTl);
    if (navTags.length) url += '&tags=' + navTags.join(',');
    return url;
  };

  let html = '';
  if (prev) html += `<a class="ev-nav-card" href="${navHref(prev)}"><span class="ev-nav-arrow">↑</span><span><em>上一条</em>${escapeHtml(prev.title)}</span></a>`;
  if (next) html += `<a class="ev-nav-card" href="${navHref(next)}"><span class="ev-nav-arrow">↓</span><span><em>下一条</em>${escapeHtml(next.title)}</span></a>`;
  if (html) el.innerHTML = '<div class="ev-nav">' + html + '</div>';
  else el.innerHTML = '<p class="ev-nav-empty">当前筛选下没有其他事件</p>';
}
