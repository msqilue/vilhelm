/* ===== 时间线页逻辑 ===== */
const state = {
  timeline: 'all',      // 'all' 或时间线 id
  tags: new Set(),      // 选中的标签 id（跨类别 AND、同类别 OR）
  keyword: ''
};

initPage('timeline.html').then(renderAll);

function renderAll() {
  renderSwitch();
  renderFilter();
  renderTimeline();
}

/* 时间线切换器 */
function renderSwitch() {
  const el = document.getElementById('tl-switch');
  const items = [{ id: 'all', name: '全部' }, ...DATA.timelines];
  el.innerHTML = items.map(t =>
    `<span class="chip ${state.timeline === t.id ? 'on' : ''}" data-tl="${t.id}">${escapeHtml(t.name)}</span>`
  ).join('');
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.timeline = chip.dataset.tl;
      renderAll();
    });
  });
}

/* 筛选面板：四类别 → 标签多选 */
function renderFilter() {
  const el = document.getElementById('filter-panel');
  if (!DATA.categories.length) { el.innerHTML = ''; return; }
  el.innerHTML = DATA.categories.map(c => {
    const tags = c.tags.map(t =>
      `<span class="tag-chip ${state.tags.has(t.id) ? 'on' : ''}" data-tag="${t.id}" style="${t.color ? 'border-color:' + t.color + ';color:' + (state.tags.has(t.id) ? t.color : t.color) : ''}">${escapeHtml(t.name)}</span>`
    ).join('');
    return `<div class="filter-group"><h4>${escapeHtml(c.name)}</h4><div class="filter-tags">${tags}</div></div>`;
  }).join('') +
    `<div class="filter-summary">已选 ${state.tags.size} 个标签 <a href="#" id="clear-filter">清除</a></div>`;

  el.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.tag;
      if (state.tags.has(id)) state.tags.delete(id); else state.tags.add(id);
      renderAll();
    });
  });
  const clear = el.querySelector('#clear-filter');
  if (clear) clear.addEventListener('click', e => {
    e.preventDefault();
    state.tags.clear();
    renderAll();
  });
}

/* 过滤 + 排序 */
function visibleEvents() {
  let list = DATA.events.filter(ev => {
    if (state.timeline !== 'all' && ev.timelineId !== state.timeline) return false;
    // 标签：跨类别 AND、同类别 OR
    for (const c of DATA.categories) {
      const selected = [...state.tags].filter(tid => c.tags.some(t => t.id === tid));
      if (selected.length && !selected.some(tid => (ev.tags || []).includes(tid))) return false;
    }
    if (state.keyword) {
      const kw = state.keyword.toLowerCase();
      const hay = [ev.title, ev.content, ev.quote, ev.stage, ...(ev.characters || []), ...eventTags(ev).map(t => t.name)].join(' ').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
  return sortEvents(list);
}

/* 时间轴渲染 */
function renderTimeline() {
  const el = document.getElementById('timeline');
  const list = visibleEvents();
  if (!list.length) {
    el.innerHTML = `<p class="empty-tip">没有符合条件的事件。</p>`;
    return;
  }
  el.innerHTML = list.map(ev => {
    const tl = getTimeline(ev.timelineId);
    const imp = ev.importance || 'normal';
    const tags = eventTags(ev);
    const excerpt = (ev.content || '').split('\n').filter(Boolean).join(' ').slice(0, 60);
    const thumb = ev.images && ev.images.length ? ev.images[0] : null;
    return `
      <article class="event-item importance-${imp}" data-id="${ev.id}">
        <div class="event-card">
          <div class="event-meta">
            ${tl ? `<span>${escapeHtml(tl.name)}</span>` : ''}
            ${ev.stage ? `<span>${escapeHtml(ev.stage)}</span>` : ''}
            ${imp !== 'normal' ? `<span class="badge ${imp === 'milestone' ? 'badge-milestone' : ''}">${importanceLabel(imp)}</span>` : ''}
          </div>
          <h3 class="event-title">${escapeHtml(ev.title)}</h3>
          ${excerpt ? `<p class="event-excerpt">${escapeHtml(excerpt)}…</p>` : ''}
          ${thumb ? `<div class="event-thumb"><img src="${escapeHtml(thumb)}" alt="" loading="lazy"></div>` : ''}
          <div class="event-detail" id="detail-${ev.id}">
            ${renderDetail(ev, tags)}
          </div>
        </div>
      </article>`;
  }).join('');

  el.querySelectorAll('.event-item').forEach(item => {
    const id = item.dataset.id;
    const card = item.querySelector('.event-card');
    card.addEventListener('click', e => {
      if (e.target.closest('.like-btn') || e.target.closest('audio') || e.target.closest('.detail-images img')) return;
      const detail = document.getElementById('detail-' + id);
      detail.classList.toggle('open');
    });
    // 灯箱
    item.querySelectorAll('.detail-images img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.dataset.full || img.src));
    });
    // 点赞
    const likeBtn = item.querySelector('.like-btn');
    if (likeBtn) {
      const refresh = () => { likeBtn.classList.toggle('on', isLiked(id)); likeBtn.textContent = isLiked(id) ? '已赞 ♥' : '点赞 ♡'; };
      refresh();
      likeBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleLike(id);
        refresh();
      });
    }
  });
}

function renderDetail(ev, tags) {
  const quote = DATA.site.features.quote && ev.quote ? `<div class="detail-quote">${escapeHtml(ev.quote)}</div>` : '';
  const chars = DATA.site.features.characters && ev.characters && ev.characters.length
    ? `<div class="detail-tags">${ev.characters.map(c => `<span class="tag-chip on">${escapeHtml(c)}</span>`).join('')}</div>` : '';
  const images = ev.images && ev.images.length
    ? `<div class="detail-images">${ev.images.map(src => `<img src="${escapeHtml(src)}" data-full="${escapeHtml(src)}" alt="" loading="lazy">`).join('')}</div>` : '';
  const audios = ev.audios && ev.audios.length
    ? `<div class="detail-audios">${ev.audios.map(a =>
        `<div><audio controls preload="none" src="${escapeHtml(a.src)}"></audio>${a.label ? `<span class="badge">${escapeHtml(a.label)}</span>` : ''}</div>`).join('')}</div>` : '';
  const tagRow = tags.length
    ? `<div class="detail-tags">${tags.map(t => `<span class="tag-chip on" style="border-color:${escapeHtml(t.color || '#8A6D3B')};color:${escapeHtml(t.color || '#8A6D3B')}">${escapeHtml(t.name)}</span>`).join('')}</div>` : '';
  const date = DATA.site.features.recordDate && ev.recordDate ? `<span>记录于 ${escapeHtml(ev.recordDate)}</span>` : '';
  const body = (ev.content || '').split('\n').filter(l => l.trim()).map(l => `<p>${escapeHtml(l)}</p>`).join('');

  return `
    ${body}
    ${quote}
    ${images}
    ${audios}
    ${tagRow}
    ${chars}
    <div class="detail-actions">
      <button class="like-btn" data-id="${ev.id}">点赞 ♡</button>
      ${date}
    </div>`;
}

/* 搜索防抖 */
const searchEl = document.getElementById('search');
searchEl.addEventListener('input', () => {
  clearTimeout(searchEl._t);
  searchEl._t = setTimeout(() => {
    state.keyword = searchEl.value.trim();
    renderTimeline();
  }, 300);
});
