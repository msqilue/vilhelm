/* ===== 事件详情页逻辑 ===== */
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

  // 事件级背景图：进入详情页时自动切换为该事件背景（优先事件指定背景，否则用第二张图片）
  const evBg = ev.bgImage || (ev.images && ev.images.length >= 2 ? ev.images[1] : '');
  if (evBg) BG.apply(evBg);

  document.title = ev.title + ' · 莫弈·Vilhelm';
  renderEvent(ev);

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

  /* 上一条 / 下一条（按当前时间线剧情顺序） */
  renderNav(ev);
});

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
    ${ev.stage ? `<span class="ev-badge">${escapeHtml(ev.stage)}</span>` : ''}
    ${ev.date ? `<span class="ev-badge">${escapeHtml(ev.date)}</span>` : ''}
    ${imp !== 'normal' ? `<span class="ev-badge ${imp === 'milestone' ? 'ev-badge-gold' : 'ev-badge-soft'}">${importanceLabel(imp)}</span>` : ''}
  `;
  document.getElementById('ev-title').textContent = ev.title;

  const audios = ev.audios && ev.audios.length
    ? `<section class="ev-sec"><h2 class="ev-sec-title">语音 · Voice</h2>
      <div class="detail-audios">${ev.audios.map(a => {
        const src = typeof a === 'string' ? a : (a && a.src);
        const label = (a && typeof a === 'object') ? (a.label || '') : '';
        return `<div class="audio-card"><span class="audio-disc">♪</span><audio controls preload="none" src="${escapeHtml(src)}"></audio>${label ? `<span class="badge">${escapeHtml(label)}</span>` : ''}</div>`;
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
    ? `<div class="detail-tags">${tags.map(t => `<span class="tag-chip on" style="border-color:${escapeHtml(t.color || '#6E8F4E')};color:${escapeHtml(t.color || '#6E8F4E')}">${escapeHtml(t.name)}</span>`).join('')}</div>` : '';
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

/* 上一条 / 下一条：同时间线内按剧情顺序（倒序展示） */
function renderNav(ev) {
  const el = document.getElementById('ev-nav');
  const siblings = DATA.events
    .filter(e => e.timelineId === ev.timelineId && e.id !== ev.id)
    .sort((a, b) => (b.order - a.order) || (a.createdAt < b.createdAt ? 1 : -1));
  const idx = siblings.findIndex(e => e.order <= ev.order);
  const prev = idx >= 0 ? siblings[idx] : null;      // 剧情上更早（展示在其上方）
  const next = idx + 1 < siblings.length ? siblings[idx + 1] : null; // 剧情上更晚

  let html = '';
  if (prev) html += `<a class="ev-nav-card" href="event.html?id=${encodeURIComponent(prev.id)}"><span class="ev-nav-arrow">↑</span><span><em>上一条</em>${escapeHtml(prev.title)}</span></a>`;
  if (next) html += `<a class="ev-nav-card" href="event.html?id=${encodeURIComponent(next.id)}"><span class="ev-nav-arrow">↓</span><span><em>下一条</em>${escapeHtml(next.title)}</span></a>`;
  el.innerHTML = html || '<p class="ev-nav-empty">这条时间线目前只有这一个事件</p>';
}
