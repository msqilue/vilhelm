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
      `<span class="tag-chip ${state.tags.has(t.id) ? 'on' : ''}" data-tag="${t.id}" style="${t.color ? 'border-color:' + t.color + ';' + (state.tags.has(t.id) ? 'color:' + t.color : '') : ''}">${escapeHtml(t.name)}</span>`
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

/* 过滤 + 排序（倒序：最新在前） */
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

/* 时间轴 A：左右交替式渲染（点击卡片 → 跳转独立详情页） */
function renderTimeline() {
  const el = document.getElementById('timeline');
  const list = visibleEvents();
  if (!list.length) {
    el.innerHTML = `<p class="empty-tip">没有符合条件的事件。</p>`;
    return;
  }
  el.innerHTML = list.map((ev, i) => {
    const tl = getTimeline(ev.timelineId);
    const imp = ev.importance || 'normal';
    const excerpt = ev.subtitle || (ev.content || '').split('\n').filter(Boolean).join(' ').slice(0, 60);
    const excerptSub = ev.subtitle ? ' sub' : '';
    const thumb = (ev.images && ev.images.length) ? ev.images[0] : null;
    const side = (i % 2 === 0) ? 'left' : 'right';
    return `
      <div class="tl-row ${side}" data-id="${ev.id}">
        <span class="node importance-${imp}"></span>
        <article class="event-card tl-card" data-href="event.html?id=${encodeURIComponent(ev.id)}">
          ${thumb ? `<div class="card-media"><img src="${escapeHtml(thumb)}" alt="" loading="lazy"></div>` : ''}
          <div class="card-body">
            <div class="event-meta">
              ${tl ? `<span>${escapeHtml(tl.name)}</span>` : ''}
              ${ev.stage ? `<span>${escapeHtml(ev.stage)}</span>` : ''}
              ${ev.date ? `<span>${escapeHtml(ev.date)}</span>` : ''}
              ${imp !== 'normal' ? `<span class="badge ${imp === 'milestone' ? 'badge-milestone' : ''}">${importanceLabel(imp)}</span>` : ''}
            </div>
            <h3 class="event-title">${escapeHtml(ev.title)}</h3>
            ${excerpt ? `<p class="event-excerpt${excerptSub}">${escapeHtml(excerpt)}${ev.subtitle ? '' : '…'}</p>` : ''}
            <div class="card-foot">
              <span class="card-open">查看详情 →</span>
              <button class="like-btn" data-id="${ev.id}">点赞 ♡</button>
            </div>
          </div>
        </article>
      </div>`;
  }).join('');

  el.querySelectorAll('.event-card').forEach(card => {
    const id = card.dataset.href;
    card.addEventListener('click', e => {
      if (e.target.closest('.like-btn')) return;
      location.href = card.dataset.href;
    });
  });
  // 点赞（localStorage）
  el.querySelectorAll('.like-btn').forEach(btn => {
    const id = btn.dataset.id;
    const refresh = () => { btn.classList.toggle('on', isLiked(id)); btn.textContent = isLiked(id) ? '已赞 ♥' : '点赞 ♡'; };
    refresh();
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleLike(id);
      refresh();
    });
  });
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
