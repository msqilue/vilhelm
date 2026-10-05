/* ===== 事件详情页逻辑 ===== */
(function () {
/* 页面私有音频与一次性交互监听：SPA 切换离开本页时由 cleanup 暂停/移除 */
const pageAudios = [];
const autoOnceHandlers = [];

/* 序号为 0 的语音为「自动播放语音」：点进事件自动播放，不在语音列表显示。
   命名规则：{事件名}-{时间}-0.mp3（-0. 结尾即视为自动播放语音） */
function isAutoAudio(a) {
  const src = typeof a === 'string' ? a : (a && a.src);
  return !!src && /-0\.[a-z0-9]+$/i.test(src.split('/').pop().split('?')[0]);
}

/* 自动播放：立即尝试播放；被浏览器拦截时，等待用户首次交互后播放一次 */
function playAutoAudio(src) {
  if (!src) return;
  const audio = new Audio(src);
  pageAudios.push(audio);
  audio.volume = 1;
  const tryPlay = () => {
    const p = audio.play();
    if (p && p.catch) p.catch(() => {
      const once = () => {
        audio.play().catch(() => {});
        autoOnceHandlers.forEach(h => ['pointerdown', 'keydown', 'touchstart'].forEach(e2 => document.removeEventListener(e2, h)));
      };
      autoOnceHandlers.push(once);
      ['pointerdown', 'keydown', 'touchstart'].forEach(evt =>
        document.addEventListener(evt, once, { once: true }));
    });
  };
  tryPlay();
}

initPage('timeline.html').then(() => {
  const id = new URLSearchParams(location.search).get('id');
  const ev = DATA.events.find(e => e.id === id);
  const head = document.getElementById('ev-head');
  const body = document.getElementById('ev-body');
  const actions = document.getElementById('ev-actions');
  const nav = document.getElementById('ev-nav');

  if (!ev) {
    head.innerHTML = '<a class="back-link" href="timeline.html">← 返回时间线</a>';
    body.innerHTML = '<p>未找到该事件（id: ' + escapeHtml(id || '空') + '）。它可能已被删除。</p>';
    return;
  }

  /* SR/MR/R 事件走语音卡版式（本页为 SSS/SSR 版式，直接跳转） */
  if ((ev.tags || []).some(t => ['t27', 't28', 't29'].includes(t))) {
    navigateTo('event-voice.html' + location.search, true);
    return;
  }

  // 事件级背景图：进入详情页时自动切换为该事件背景（优先事件指定背景，否则用第二张图片）
  const evBg = ev.bgImage || (ev.images && ev.images.length >= 2 ? ev.images[1] : '');
  if (evBg) BG.apply(evBg);

  document.title = ev.title + ' · 莫弈·Vilhelm';
  renderEvent(ev);

  /* 自动播放语音（序号 0）：不显示在列表，进页自动播放 */
  const autoAudio = (ev.audios || []).find(isAutoAudio);
  if (autoAudio) {
    const src = typeof autoAudio === 'string' ? autoAudio : (autoAudio && autoAudio.src);
    playAutoAudio(src);
  }

  /* 点赞 */
  const likeBtn = actions.querySelector('.like-btn');
  const refreshLike = () => {
    likeBtn.classList.toggle('on', isLiked(ev.id));
    likeBtn.textContent = isLiked(ev.id) ? '已赞 ♥' : '点赞 ♡';
  };
  refreshLike();
  likeBtn.addEventListener('click', () => { toggleLike(ev.id); refreshLike(); });

  /* 灯箱 */
  body.querySelectorAll('.detail-images img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.dataset.full || img.src));
  });

  /* 图片悬浮「设为背景」：点击后把该图设为页面背景（路径不写死，可随时更换） */
  body.querySelectorAll('.set-bg-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const src = btn.dataset.src;
      if (!src) return;
      BG.setBg(src).then(() => {
        btn.textContent = '已设为背景 ✓';
        btn.classList.add('done');
        setTimeout(() => { btn.textContent = '设为背景'; btn.classList.remove('done'); }, 1600);
      });
    });
  });

  /* 自定义音频播放器：播放/暂停、进度条、时间显示 */
  initAudioPlayers(body);

  /* 上一条 / 下一条（按当前时间线剧情顺序） */
  renderNav(ev);
});

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function initAudioPlayers(root) {
  root.querySelectorAll('.audio-custom').forEach(box => {
    const audio = new Audio();
    pageAudios.push(audio);
    audio.preload = 'none';
    audio.src = box.dataset.src;
    const playBtn = box.querySelector('.ac-play');
    const fill = box.querySelector('.ac-fill');
    const timeEl = box.querySelector('.ac-time');

    playBtn.addEventListener('click', () => {
      audio.paused ? audio.play() : audio.pause();
    });
    audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; });
    audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
    audio.addEventListener('ended', () => { playBtn.textContent = '▶'; fill.style.width = '0%'; timeEl.textContent = '0:00 / 0:00'; });
    audio.addEventListener('timeupdate', () => {
      const p = audio.duration ? audio.currentTime / audio.duration : 0;
      fill.style.width = (p * 100) + '%';
      timeEl.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration);
    });
    audio.addEventListener('loadedmetadata', () => {
      timeEl.textContent = '0:00 / ' + fmtTime(audio.duration);
    });

    const track = box.querySelector('.ac-track');
    track.addEventListener('click', e => {
      const r = track.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      if (audio.duration) {
        audio.currentTime = p * audio.duration;
        fill.style.width = (p * 100) + '%';
      }
    });
  });
}

function renderEvent(ev) {
  const tl = getTimeline(ev.timelineId);
  const imp = ev.importance || 'normal';
  const tags = eventTags(ev);

  // 沉浸式 Hero：事件首图作为顶部背景，标题与元信息叠放其上
  const heroImg = (ev.images && ev.images[0]) || '';
  const head = document.getElementById('ev-head');
  head.classList.toggle('has-bg', !!heroImg);
  if (heroImg) head.style.backgroundImage = `url("${heroImg}")`;

  document.getElementById('ev-meta').innerHTML = `
    ${tl ? `<span class="ev-badge ev-badge-solid">${escapeHtml(tl.name)}</span>` : ''}
    ${mainTagOf(ev) ? `<span class="ev-badge" style="color:${mainTagOf(ev).color};border-color:${mainTagOf(ev).color}">${escapeHtml(mainTagOf(ev).name)}</span>` : ''}
    ${ev.stage ? `<span class="ev-badge">${escapeHtml(ev.stage)}</span>` : ''}
    ${ev.date ? `<span class="ev-badge">${escapeHtml(ev.date)}</span>` : ''}
    ${imp !== 'normal' ? `<span class="ev-badge ${imp === 'milestone' ? 'ev-badge-gold' : 'ev-badge-soft'}">${importanceLabel(imp)}</span>` : ''}
  `;
  document.getElementById('ev-title').textContent = ev.title;
  const subEl = document.getElementById('ev-subtitle');
  if (ev.subtitle) {
    subEl.textContent = '『' + ev.subtitle + '』';
    subEl.style.display = '';
  } else {
    subEl.textContent = '';
    subEl.style.display = 'none';
  }

  const listAudios = (ev.audios || []).filter(a => !isAutoAudio(a));
  const audios = listAudios.length
    ? `<section class="ev-sec"><h2 class="ev-sec-title">语音 · Voice</h2>
      <div class="detail-audios">${listAudios.map(a => {
        const src = typeof a === 'string' ? a : (a && a.src);
        const label = (a && typeof a === 'object') ? (a.label || '') : '';
        return `<div class="audio-card"><span class="audio-disc">♪</span>
          <div class="audio-custom" data-src="${escapeHtml(src)}">
            <button class="ac-play" type="button" aria-label="播放">▶</button>
            <div class="ac-track"><div class="ac-fill"></div></div>
            <span class="ac-time">0:00 / 0:00</span>
          </div>${label ? `<span class="badge">${escapeHtml(label)}</span>` : ''}</div>`;
      }).join('')}</div></section>` : '';
  const images = ev.images && ev.images.length
    ? `<section class="ev-sec"><h2 class="ev-sec-title">留影 · Gallery</h2>
      <div class="detail-images">${ev.images.map(src =>
        `<span class="img-wrap"><img src="${escapeHtml(src)}" data-full="${escapeHtml(src)}" alt="" loading="lazy">
          <button class="set-bg-btn" data-src="${escapeHtml(src)}" title="将这张图设为页面背景">设为背景</button></span>`).join('')}</div></section>` : '';
  const body = (ev.content || '').split('\n').filter(l => l.trim()).map(l => `<p>${escapeHtml(l)}</p>`).join('');
  const quotes = (DATA.site.features.quote && (ev.quotes || (ev.quote ? [ev.quote] : [])) || [])
    .map(q => `<div class="quote-card"><div class="quote-mark">❝</div><div class="quote-text">${escapeHtml(q)}</div></div>`).join('');
  const tagRow = tags.length
    ? `<div class="detail-tags">${tags.map(t => `<span class="tag-chip ev-tag" style="border-color:${escapeHtml(t.color || '#6E8F4E')};color:${escapeHtml(t.color || '#6E8F4E')}">${escapeHtml(t.name)}</span>`).join('')}</div>` : '';
  const chars = DATA.site.features.characters && ev.characters && ev.characters.length
    ? `<div class="detail-chars">${ev.characters.map(c => `<span class="char-chip">${escapeHtml(c)}</span>`).join('')}</div>` : '';
  const date = DATA.site.features.recordDate && ev.recordDate ? `<span class="ev-date">记录于 ${escapeHtml(ev.recordDate)}</span>` : '';

  document.getElementById('ev-body').innerHTML = `
    ${body ? `<section class="ev-sec ev-prose">${body}</section>` : ''}
    ${quotes ? `<section class="ev-sec"><div class="quote-block">${quotes}</div></section>` : ''}
    ${audios}
    ${images}
    <div class="ev-tail">
      ${tagRow}
      ${chars}
    </div>
  `;
  document.getElementById('ev-actions').innerHTML =
    `<button class="like-btn" data-id="${ev.id}">点赞 ♡</button>${date}`;
}

/* 上一条 / 下一条：按时间线页的当前筛选（时间线 + 标签）顺序导航；
   未携带筛选参数时退化为同时间线内全量排序（与时间线页一致：日期倒序，最新在上） */
function navScope(ev) {
  const params = new URLSearchParams(location.search);
  const navTl = params.get('tl');
  const navTags = (params.get('tags') || '').split(',').filter(Boolean);
  let list = DATA.events.filter(e => e.timelineId === ev.timelineId);
  if (navTl && navTl !== 'all' && navTl !== ev.timelineId) list = [];
  if (navTags.length) {
    // 与时间线页筛选规则一致：跨类别 AND、同类别 OR
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
  const el = document.getElementById('ev-nav');
  const { ordered, navTl, navTags } = navScope(ev);
  const idx = ordered.findIndex(e => e.id === ev.id);
  const prev = idx > 0 ? ordered[idx - 1] : null;        // 时间线上方：更新的
  const next = (idx >= 0 && idx + 1 < ordered.length) ? ordered[idx + 1] : null; // 时间线下方：更早的

  const navHref = (id) => {
    const e = DATA.events.find(x => x.id === id);
    const page = e && (e.tags || []).some(t => ['t27', 't28', 't29'].includes(t)) ? 'event-voice.html' : 'event.html';
    let url = page + '?id=' + encodeURIComponent(id);
    if (navTl && navTl !== 'all') url += '&tl=' + encodeURIComponent(navTl);
    if (navTags.length) url += '&tags=' + navTags.join(',');
    return url;
  };

  let html = '';
  if (prev) html += `<a class="ev-nav-card" href="${navHref(prev.id)}"><span class="ev-nav-arrow">↑</span><span><em>上一条</em>${escapeHtml(prev.title)}</span></a>`;
  if (next) html += `<a class="ev-nav-card" href="${navHref(next.id)}"><span class="ev-nav-arrow">↓</span><span><em>下一条</em>${escapeHtml(next.title)}</span></a>`;
  el.innerHTML = html || '<p class="ev-nav-empty">当前筛选下没有其他事件</p>';
}

/* SPA 卸载钩子：暂停页面私有音频、移除自动播放的交互监听 */
window.__vilhelmCleanup = function () {
  pageAudios.forEach(a => { try { a.pause(); } catch (e) {} });
  autoOnceHandlers.forEach(h => ['pointerdown', 'keydown', 'touchstart'].forEach(e2 => document.removeEventListener(e2, h)));
};
})();
